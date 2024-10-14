import { IconName, ItemView, Notice, WorkspaceLeaf } from "obsidian";
import JournalChatPlugin from "./main";
import ollama from "ollama";
import { getNotes } from "getNotes";
import { Remarkable } from "remarkable";

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
	isStreaming: boolean; // Track streaming status

	constructor(leaf: WorkspaceLeaf, plugin: JournalChatPlugin) {
		super(leaf);
		this.plugin = plugin;
		this.messages = [];
		this.icon = "message-circle";
		this.commands = ["/c", "/clear", "/context", "/stop"];
		this.isStreaming = false; // Initialize streaming status
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

		const messageContainer = container.createDiv({
			cls: "journal-chat-message-container",
		});

		const inputContainer = container.createDiv({
			cls: "journal-chat-input-container",
		});

		const input = inputContainer.createEl("input", {
			type: "text",
			placeholder: "Type a message or / for command",
			cls: "journal-chat-input",
		});

		const suggestionBox = inputContainer.createDiv({
			cls: "journal-chat-suggestion-box",
		});

		const stopButton = inputContainer.createEl("button", {
			text: "Stop",
			cls: "journal-chat-stop-button", // Use the same class for consistent styling
		});

		stopButton.addEventListener("click", () => {
			if (this.isStreaming) {
				ollama.abort(); // Stop the stream
				new Notice("Streaming stopped.", 5000);
				this.isStreaming = false;
			}
		});

		input.addEventListener("input", () => {
			const value = input.value.trim();
			suggestionBox.empty();
			if (value.startsWith("/")) {
				const suggestions = this.commands.filter((command) =>
					command.startsWith(value)
				);
				if (suggestions.length > 0) {
					suggestionBox.style.display = "block";
					suggestions.forEach((suggestion) => {
						const suggestionItem = suggestionBox.createDiv({
							text: suggestion,
							cls: "journal-chat-suggestion-item",
						});
						suggestionItem.addEventListener("click", () => {
							input.value = suggestion;
							suggestionBox.empty();
							suggestionBox.style.display = "none";
						});
					});
				} else {
					suggestionBox.style.display = "none";
				}
			} else {
				suggestionBox.style.display = "none";
			}
		});

		input.addEventListener("keydown", (event) => {
			if (
				event.key === "Tab" &&
				suggestionBox.style.display === "block"
			) {
				event.preventDefault();
				const firstSuggestion = suggestionBox.querySelector(
					".journal-chat-suggestion-item"
				);
				if (firstSuggestion) {
					input.value = firstSuggestion.textContent || "";
					suggestionBox.empty();
					suggestionBox.style.display = "none";
				}
			}
		});

		input.addEventListener("keypress", async (event) => {
			if (event.key === "Enter") {
				suggestionBox.empty();
				suggestionBox.style.display = "none"; // Hide the suggestion box
				const message = input.value;

				if (message.trim()) {
					if (
						message.trim() === "/c" ||
						message.trim() === "/clear"
					) {
						messageContainer.empty();
						input.value = "";
						this.messages = [];
					} else if (message.trim() === "/stop") {
						if (this.isStreaming) {
							ollama.abort(); // Stop the stream
							new Notice("Streaming stopped.", 5000);
							this.isStreaming = false;
							input.value = "";
						}
					} else if (message.trim().startsWith("/context")) {
						const notesData = await getNotes(
							this.app.vault,
                            this.plugin.settings,
							message.replace("/context", ""),
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
								// Replace existing context
								this.messages[0] = userContextMessage;
								this.messages[1] = assistantContextMessage;
							} else {
								// Insert new context
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
					} else {
						this.addMessage(messageContainer, "User", message);
						input.value = "";

						const thinkingMessage = this.addMessage(
							messageContainer,
							"Chatbot",
							""
						);
						thinkingMessage.classList.add("animated-dots");

						const md = new Remarkable();
						let content = "";

						try {
							this.messages.push({
								role: "user",
								content: message,
							});

							// Stream the response
							this.isStreaming = true; // Set streaming status

							for await (const part of await ollama.generate({
								model: this.plugin.settings.model,
								prompt: this.messages
									.map((msg) => `${msg.role}: ${msg.content}`)
									.join("\n"),
								stream: true,
							})) {
								if (!this.isStreaming) break; // Stop if streaming is aborted

								content += part.response;
								thinkingMessage.innerHTML = md.render(content);
								messageContainer.scrollTop =
									messageContainer.scrollHeight;
								thinkingMessage.classList.remove(
									"animated-dots"
								);
							}

							// Only push the assistant message if streaming wasn't stopped
							if (this.isStreaming) {
								this.messages.push({
									role: "assistant",
									content: content,
								});
							}

							console.log(this.messages);
						} catch (error) {
							console.error("Error fetching response:", error);
							if (this.isStreaming) {
								// Only show error message if not manually stopped
								thinkingMessage.innerHTML = md.render(
									"Sorry, there was an error processing your request."
								);
								messageContainer.scrollTop =
									messageContainer.scrollHeight;
								thinkingMessage.classList.remove(
									"animated-dots"
								);
							}
						} finally {
							this.isStreaming = false; // Reset streaming status
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
		const messageEl = container.createDiv({
			cls: "journal-chat-message",
		});
		const md = new Remarkable();
		const htmlContent = md.render(text);
		const messageContent = messageEl.createDiv();
		messageContent.innerHTML = htmlContent;

		container.scrollTop = container.scrollHeight;

		return messageEl;
	}

	async onClose() {
		// Nothing to clean up.
	}
}
