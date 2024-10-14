import { Plugin, WorkspaceLeaf } from "obsidian";
import {
	JournalChatSettingsTab,
	JournalChatSettings,
	DEFAULT_SETTINGS,
} from "settings";

import { ChatbotView, VIEW_TYPE_CHATBOT } from "chat";

export default class JournalChatPlugin extends Plugin {
	settings: JournalChatSettings;

	async onload() {
		await this.loadSettings();
		this.addSettingTab(new JournalChatSettingsTab(this.app, this));

		// Register chat view
		this.registerView(
			VIEW_TYPE_CHATBOT,
			(leaf) => new ChatbotView(leaf, this)
		);

		this.addRibbonIcon("message-circle", "Open Journal Chat", () => {
			this.activateView();
		});

		// Add command for opening the chat view
		this.addCommand({
			id: 'open-journal-chat',
			name: 'Open',
			callback: () => {
				this.activateView();
			},
		});
	}

	// Load / save settings

	async loadSettings() {
		this.settings = Object.assign(
			{},
			DEFAULT_SETTINGS,
			await this.loadData()
		);
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	// Chat

	async activateView() {
		const { workspace } = this.app;

		let leaf: WorkspaceLeaf | null = null;
		const leaves = workspace.getLeavesOfType(VIEW_TYPE_CHATBOT);

		if (leaves.length > 0) {
			leaf = leaves[0];
		} else {
			leaf = workspace.getLeaf(true); // Opens in the main editor
			await leaf?.setViewState({ type: VIEW_TYPE_CHATBOT, active: true });
		}

		// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
		workspace.revealLeaf(leaf!);
	}

	// Load daily notes
}