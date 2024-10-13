import { ItemView, Notice, WorkspaceLeaf } from "obsidian";
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

	constructor(leaf: WorkspaceLeaf, plugin: JournalChatPlugin) {
		super(leaf);
		this.plugin = plugin;
		this.messages = [];
	}

	getViewType() {
		return VIEW_TYPE_CHATBOT;
	}

	getDisplayText() {
		return "Chatbot";
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
			placeholder: "Type a message...",
			cls: "journal-chat-input",
		});

		const clearButton = inputContainer.createEl("button", {
			text: "Clear",
			cls: "journal-chat-clear-button",
		});

		clearButton.addEventListener("click", () => {
			this.messages = [];
			messageContainer.empty();
		});

		input.addEventListener("keypress", async (event) => {
			if (event.key === "Enter") {
				const message = input.value;

				if (message.trim()) {
					if (
						message.trim() === "/c" ||
						message.trim() === "/clear"
					) {
						messageContainer.empty();
						input.value = "";
						this.messages = [];
					} else if (message.trim().startsWith("/context")) {
						const notesString = await getNotes(
							this.app.vault,
							message.replace("/context", "")
						);
						let context = "";
						if (notesString.length > 0) {
							context = `These are my journals from this time period:
                        ${notesString}
                        ---
                        Answer my questions about my journals above, and do not provide any opinions of your own.`;
						}
						this.messages[0] = {
							role: "user",
							content: context,
						};
						this.messages[1] = {
							role: "assistant",
							content: `I understand these are your journals, and that I have your explicit consent to read through them.
                                    I will keep anything in this conversation confidential, between us two only.         
                                    I will answer your question and your question only, without any unwanted details.
                                    Please ask me anything about them, and I will do my best to help you.`,
						};
						input.value = "";
						new Notice(
							`Successfully added journals of ${context.length} characters`,
							10000
						);
					} else {
						this.addMessage(messageContainer, "User", message);
						input.value = "";

						const thinkingMessage = this.addMessage(
							messageContainer,
							"Chatbot",
							"..."
						);
						let dots = "...";
						const interval = setInterval(() => {
							dots = dots.length < 5 ? dots + "." : ".";
							if (thinkingMessage.lastChild) {
								thinkingMessage.lastChild.textContent = dots;
							}
						}, 300);

						if (this.messages.length === 0) {
							let notesString;
							if (this.messages.length === 0) {
								notesString = await getNotes(
									this.app.vault,
									message
								);
							} else {
								notesString = "No notes were found";
							}
							const context = `These are my journals from this time period:
                                            ${notesString}
                                            ---
                                            Answer my questions about my journals above, and do not provide any opinions of your own.
                                            `;
							this.messages.push({
								role: "user",
								content: context,
							});
							this.messages.push({
								role: "assistant",
								content: `I understand these are your journals, and that I have your explicit consent to read through them.
                                    I will keep anything in this conversation confidential, between us two only. 
                                    I will answer your question and your question only, without any unwanted details.
                                    Please ask me anything about them, and I will do my best to help you.`,
							});
						}

						try {
							this.messages.push({
								role: "user",
								content: message,
							});

							const prompt = this.messages
								.map((msg) => `${msg.role}: ${msg.content}`)
								.join("\n");

							const response = await ollama.generate({
								model: this.plugin.settings.model,
								prompt: prompt,
							});

							clearInterval(interval);
							thinkingMessage.remove();

							this.addMessage(
								messageContainer,
								"Chatbot",
								response.response
							);
							this.messages.push({
								role: "assistant",
								content: response.response
							});
							console.log(this.messages);
						} catch (error) {
							clearInterval(interval);
							console.error("Error fetching response:", error);
							thinkingMessage.remove();
							this.addMessage(
								messageContainer,
								"Chatbot",
								"Sorry, there was an error processing your request."
							);
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
		const messageEl = container.createDiv({ cls: "journal-chat-message" });
		messageEl.createEl("strong", { text: `${sender} ` });

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