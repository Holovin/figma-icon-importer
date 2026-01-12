# Figma Icon Importer
<img width="442" height="562" alt="image" src="https://github.com/user-attachments/assets/9c19e370-8af5-4e79-bffb-7cd5f8d48f46" />

Plugin for bulk importing .png icons into Figma. The plugin was built for very specific purposes, but you can likely adapt it for your own needs.

### INSTALLATION
	0.	Download the project as a ZIP archive and extract it to a folder on your computer.
	1.	In the desktop version of Figma: Plugins → Development → Import plugin from manifest…
	2.	Run the plugin from the Plugins menu.

### HOW IT WORKS
The plugin expects a folder with a large number of icons named like this:

```
ico___contacts___dark___black.png
ico___contacts___dark___blue.png
ico___contacts___dark___darkblue.png
ico___contacts___dark___default.png
ico___contacts___dark1___black.png
ico___contacts___dark1___blue.png
ico___contacts___dark1___darkblue.png
ico___contacts___dark1___default.png
ico___contacts___dark2___black.png
ico___contacts___dark2___blue.png
ico___contacts___dark2___darkblue.png
ico___contacts___dark2___default.png
ico___contacts___light___black.png
ico___contacts___light___blue.png
ico___contacts___light___darkblue.png
ico___contacts___light___default.png
...
```

Supported filename format:
`[spriteName]_[iconName]_[theme]_[state].png`

You can additionally specify a custom separator (default: `_`) for cases where the sprite or icon name itself may contain that character.

Select a folder and the import will start automatically on the current Page. The process may take a long time — do not minimize or leave Figma in a background for too long, otherwise the import may slow down significantly or freeze completely.

### TODO
- [x] Basic import
- [x] Component groups & auto layout for same icons
- [x] Bad/Corrupted/Missed icons hightlighting
- [x] Logging & Progressbar
- [x] Small delay for prevent rate limit error
- [x] Prioritization of themes and colors
- [ ] Read & update already existing icons
- [ ] Full filename customization
