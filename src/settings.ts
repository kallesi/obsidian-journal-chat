import { App, PluginSettingTab, Setting, MarkdownRenderer } from "obsidian";
import JournalChatPlugin from "src/main";

export interface JournalChatSettings {
	model: string;
	journalPath: string;
}

export const DEFAULT_SETTINGS: Partial<JournalChatSettings> = {
	model: "llama3.2:latest",
	journalPath: "Journal",
};

export class JournalChatSettingsTab extends PluginSettingTab {
	plugin: JournalChatPlugin;

	constructor(app: App, plugin: JournalChatPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;

		containerEl.empty();

		// Add header
		containerEl.createEl("h1", { text: "Journal Chat" });
		containerEl.createEl("h4", { text: "Settings" });

		// Add description
		containerEl.createEl("p", {
			text: `Explore old memories and enhanced periodic reviews with local AI. Requires Ollama to be installed.`,
		});

		// Add links
		const linksContainer = containerEl.createDiv({ cls: "links-container" });

		linksContainer.createEl("a", {
			text: "GitHub",
			href: "https://github.com/kallesi/obsidian-journal-chat",
			attr: { target: "_blank" },
		});

		linksContainer.createEl("span", { text: "   " }); // Space

		linksContainer.createEl("a", {
			text: "Ollama",
			href: "https://ollama.com",
			attr: { target: "_blank" },
		});

		containerEl.createEl("br");
		containerEl.createEl("br");

		new Setting(containerEl)
			.setName("Model")
			.setDesc("Select Ollama model to use")
			.addText((text) =>
				text
					.setPlaceholder("llama3.2:latest")
					.setValue(this.plugin.settings.model)
					.onChange(async (value) => {
						this.plugin.settings.model = value;
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName("Journal Path")
			.setDesc(
				`Select your daily notes folder, currently only supports "YYYY-MM-DD" formatted files`
			)
			.addText((text) =>
				text
					.setPlaceholder("Journal")
					.setValue(this.plugin.settings.journalPath)
					.onChange(async (value) => {
						this.plugin.settings.journalPath = value;
						await this.plugin.saveSettings();
					})
			);

		containerEl.createEl('h4', { text: "Usage Guide" });

		const markdownContent = `
**Set up your model.**  
It is recommended that you use a smaller model (depending on hardware) as this uses the entire context instead of embeddings.

**Set up your journals/daily notes folder.**  
Currently only supports YYYY-MM-DD dates.

**Setting Context (adding your journals to the AI's brain):**  
Add a date range to the context by typing \`/context {daterange}\`. Accepts most natural language input.

- Example: \`/context 1 jan 2023 to 31 feb 2023\`
- Example: \`/context 2 months ago to today\`

You can change the context mid-chat by typing \`/context\` again.

**Ask your question.**  
Example: \`What was my life like during this period?\`

**Other commands:**

- \`/clear /c\` - Clear chat and context
- \`/stop\` - Stop generating response
- \`/model\` - Change Ollama model
`;

		const description = containerEl.createDiv();
		MarkdownRenderer.render(this.app, markdownContent, description, "", this.plugin);
	}
}