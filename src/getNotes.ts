import { TAbstractFile, TFile, Vault } from "obsidian";
import * as chrono from "chrono-node";

import { JournalChatSettings } from 'src/settings';

async function parseDateRange(dateInput: string) {
	const parsedDates = chrono.parse(dateInput);

	if (parsedDates.length > 0) {
		const startDate = parsedDates[0].start.date();
		startDate.setHours(0, 0, 0, 0); // Midnight of the start day

		const endDate = parsedDates[0].end ? parsedDates[0].end.date() : new Date(startDate);
		endDate.setHours(23, 59, 59, 999); // End of the day

		return { startDate, endDate };
	} else {
		console.log("No valid date found.");
		return null;
	}
}

export async function getNotes(vault: Vault, settings: JournalChatSettings, input: string): Promise<{ combinedText: string, startDate: string, endDate: string } | null> {
	const unfilteredNotes: TAbstractFile[] | undefined = vault.getFolderByPath(settings.journalPath)?.children;
	const notes = unfilteredNotes?.filter((note): note is TFile => note instanceof TFile);
	const matchingNotes: TFile[] = [];
	const dateRange = await parseDateRange(input);

	if (dateRange && notes) {
		const { startDate, endDate } = dateRange;
		notes.forEach((note) => {
			let noteDate;
			try {
				noteDate = new Date(note.name.slice(0, 10));
				if (isNaN(noteDate.getTime())) {
					throw new Error("Invalid date format");
				}
			} catch {
				noteDate = new Date("1900-01-01");
			}
			if (noteDate >= startDate && noteDate <= endDate) {
				matchingNotes.push(note);
			}
		});
	}

	console.log(dateRange);
	console.log(matchingNotes);

	let combinedText = '';

	await Promise.all(
		matchingNotes.map((note) =>
			vault.read(note)
				.then((noteString) => {
					const noteDate = new Date(note.name.slice(0, 10));
					const formattedDate = noteDate.toLocaleDateString('en-US', {
						day: 'numeric',
						month: 'short',
						year: 'numeric',
					});
					combinedText += `---\nMy Journal Entry from ${formattedDate}\n${noteString}\n`;
				})
				.catch((e) => console.log(`Error with ${note.name}, ${e}`))
		)
	);

	console.log(`${combinedText.slice(0, 150)}...`);
	console.log(`Length: ${combinedText.length} characters`);
	if (combinedText.length > 128000) {
		combinedText = combinedText.slice(0, 128000);
		console.log("Text too long, trimmed to 128,000 characters for performance");
	}

	if (dateRange) {
		return {
			combinedText,
			startDate: dateRange.startDate.toLocaleDateString('en-US'),
			endDate: dateRange.endDate.toLocaleDateString('en-US')
		};
	}
	return null;
}