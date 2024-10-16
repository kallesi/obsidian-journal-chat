import {
	IconName,
	ItemView,
	Notice,
	WorkspaceLeaf,
	MarkdownRenderer,
	Component,
} from "obsidian";
import ollama from "ollama";
import JournalChatPlugin from "src/main";
import { getNotes } from "src/getNotes";

type Message = {
	role: string;
	content: string;
};

export const VIEW_TYPE_CHATBOT = "chatbot-view";

export class ChatbotView extends ItemView {
	plugin: JournalChatPlugin;
	messages: Message[];
	icon: IconName;
	commands: string[];
	isStreaming: boolean;

	constructor(leaf: WorkspaceLeaf, plugin: JournalChatPlugin) {
		super(leaf);
		this.plugin = plugin;
		this.messages = [];
		this.icon = "message-circle";
		this.commands = ["/clear", "/context", "/stop", "/model", "/list"];
		this.isStreaming = false;
	}

	getViewType() {
		return VIEW_TYPE_CHATBOT;
	}

	getDisplayText() {
		return "Journal Chat";
	}

	async onOpen() {
		const container = this.containerEl.children[1] as HTMLElement;
		container.empty();

		const messageContainer = container.createEl("div", {
			cls: "journal-chat-message-container",
		});

		const inputContainer = container.createEl("div", {
			cls: "journal-chat-input-container",
		});

		const input = inputContainer.createEl("input", {
			type: "text",
			placeholder: "Type a message or / for command",
			cls: "journal-chat-input",
		});

		const suggestionBox = inputContainer.createEl("div", {
			cls: "journal-chat-suggestion-box",
		});

		const stopButton = inputContainer.createEl("button", {
			text: "Stop",
			cls: "journal-chat-stop-button",
		});

		stopButton.addEventListener("click", () => {
			const thinkingMessage =
				messageContainer.querySelector(".animated-dots");
			if (thinkingMessage) {
				thinkingMessage.removeClass("animated-dots");
			}
			this.isStreaming = false;
			ollama.abort();
			new Notice("Streaming stopped.", 5000);
		});

		input.addEventListener("input", () => {
			const value = input.value.trim();
			suggestionBox.empty();
			const hasSuggestions =
				value.startsWith("/") &&
				this.commands.some((command) => command.startsWith(value));
			suggestionBox.toggleClass("visible", hasSuggestions);

			if (hasSuggestions) {
				this.commands
					.filter((command) => command.startsWith(value))
					.forEach((suggestion) => {
						const suggestionItem = suggestionBox.createEl("div", {
							text: suggestion,
							cls: "journal-chat-suggestion-item",
						});
						suggestionItem.addEventListener("click", () => {
							input.value = suggestion;
							suggestionBox.empty();
							suggestionBox.removeClass("visible");
						});
					});
			}
		});

		input.addEventListener("keydown", (event) => {
			if (event.key === "Tab" && suggestionBox.hasClass("visible")) {
				event.preventDefault();
				const firstSuggestion = suggestionBox.querySelector(
					".journal-chat-suggestion-item"
				);
				if (firstSuggestion) {
					input.value = firstSuggestion.textContent || "";
					suggestionBox.empty();
					suggestionBox.removeClass("visible");
				}
			}
		});

		input.addEventListener("keypress", async (event) => {
			if (event.key === "Enter") {
				suggestionBox.empty();
				suggestionBox.removeClass("visible");
				const message = input.value;

				if (message.trim()) {
					if (message.trim() === "/clear" && !this.isStreaming) {
						messageContainer.empty();
						input.value = "";
						this.messages = [];
					} else if (message.trim() === "/stop") {
						const thinkingMessage =
							messageContainer.querySelector(".animated-dots");
						if (thinkingMessage) {
							thinkingMessage.removeClass("animated-dots");
						}
						this.isStreaming = false;
						input.value = "";
						ollama.abort();
						new Notice("Streaming stopped.", 5000);
					} else if (
						message.trim() === "/list" &&
						!this.isStreaming
					) {
						this.addMessage(
							messageContainer,
							"User",
							"List me all available models"
						);
						input.value = "";

						const thinkingMessage = this.addMessage(
							messageContainer,
							"Chatbot",
							""
						);
						thinkingMessage.addClass("animated-dots");

						let content = "";

						this.messages.push({
							role: "user",
							content: message,
						});
						const list = await ollama.list();
						list.models.map((model) => {
							content += `\n - ${model.name}`;
						});
						this.messages.push({
							role: "assistant",
							content: content,
						});
						await MarkdownRenderer.render(
							this.app,
							content,
							thinkingMessage,
							"",
							this
						);
						thinkingMessage.removeClass("animated-dots");
						console.log(this.messages);
					} else if (
						message.trim().startsWith("/context") &&
						!this.isStreaming
					) {
						const notesData = await getNotes(
							this.app.vault,
							this.plugin.settings,
							message.replace("/context", "")
						);

						if (notesData) {
							const { combinedText, startDate, endDate } =
								notesData;
							const context = `These are my journals from this time period:
                            ${combinedText}
                            ---
                            Answer my questions about my journals above, and do not provide any opinions of your own.`;

							const userContextMessage = {
								role: "user",
								content: context,
							};
							const assistantContextMessage = {
								role: "assistant",
								content: `I understand these are your journals, and that I have your explicit consent to read through them.
                                    I will keep anything in this conversation confidential, between us two only.         
                                    I will answer your question and your question only, without any unwanted details.
                                    Please ask me anything about them, and I will do my best to help you.`,
							};

							if (
								this.messages.length >= 2 &&
								this.messages[0].content.startsWith(
									"These are my journals"
								)
							) {
								this.messages[0] = userContextMessage;
								this.messages[1] = assistantContextMessage;
							} else {
								this.messages.unshift(assistantContextMessage);
								this.messages.unshift(userContextMessage);
							}

							input.value = "";
							new Notice(
								`Successfully added journals from ${startDate} to ${endDate} with ${context.length} characters`,
								10000
							);
							console.log(this.messages);
						} else {
							new Notice("No valid date range found.", 5000);
						}
					} else if (message.trim().startsWith("/model")) {
						const modelName = message.slice(7).trim().split(" ")[0];
						if (modelName) {
							this.plugin.settings.model = modelName;
							await this.plugin.saveSettings();
							new Notice(`Model changed to ${modelName}.`, 5000);
							input.value = "";
						} else {
							new Notice("Invalid model name.", 5000);
							input.value = "";
						}
					} else if (!this.isStreaming) {
						this.addMessage(messageContainer, "User", message);
						input.value = "";

						const thinkingMessage = this.addMessage(
							messageContainer,
							"Chatbot",
							""
						);
						thinkingMessage.addClass("animated-dots");

						let content = "";

						try {
							this.messages.push({
								role: "user",
								content: message,
							});

							this.isStreaming = true;

							for await (const part of await ollama.generate({
								model: this.plugin.settings.model,
								prompt: this.messages
									.map((msg) => `${msg.role}: ${msg.content}`)
									.join("\n\n"),
								stream: true,
							})) {
								if (!this.isStreaming) break;

								content += part.response;
								thinkingMessage.empty();

								if (thinkingMessage.hasClass("animated-dots")) {
									thinkingMessage.removeClass(
										"animated-dots"
									);
								}

								await MarkdownRenderer.render(
									this.app,
									content,
									thinkingMessage,
									"",
									this
								);

								const isNearBottom =
									messageContainer.scrollHeight -
										messageContainer.scrollTop <=
									messageContainer.clientHeight + 50;

								if (isNearBottom) {
									messageContainer.scrollTop =
										messageContainer.scrollHeight;
								}
							}

							if (this.isStreaming) {
								this.messages.push({
									role: "assistant",
									content: content,
								});
							}

							console.log(this.messages);
						} catch (error) {
							console.error("Error fetching response:", error);
							thinkingMessage.removeClass("animated-dots");

							thinkingMessage.createEl("div", {
								text: "Sorry, there was an error processing your request.",
								cls: "error-message",
							});

							messageContainer.scrollTop =
								messageContainer.scrollHeight;
						} finally {
							this.isStreaming = false;
						}
					}
				}
			}
		});
	}

	addMessage(
		container: HTMLDivElement,
		sender: string,
		text: string
	): HTMLDivElement {
		const messageEl = container.createEl("div", {
			cls: "journal-chat-message",
		});

		const messageContent = messageEl.createEl("div");
		const component = new Component();
		this.addChild(component);

		MarkdownRenderer.render(this.app, text, messageContent, "", component);

		container.scrollTop = container.scrollHeight;

		return messageEl;
	}

	async onClose() {
		// Nothing to clean up.
	}
}
