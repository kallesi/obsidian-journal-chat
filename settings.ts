import JournalChatPlugin from "./main";
import { App, PluginSettingTab, Setting } from "obsidian";

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
            .setDesc(`Select your daily notes folder, currently only supports "YYYY-MM-DD" formatted files`)
            .addText((text)=>
                text
                    .setPlaceholder('Journal')
                    .setValue(this.plugin.settings.journalPath)
                    .onChange(async (value) => {
                        this.plugin.settings.journalPath = value;
                        await this.plugin.saveSettings();
                    })
            )
	}
}
