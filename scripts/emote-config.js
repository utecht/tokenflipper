import { createEmoteMacro, playEmote, getDefaultEmotes } from "./emotes.js";

const MODULE_ID = "tokenflipper";

/**
 * Configuration form for managing emotes
 */
export class EmoteConfigForm extends FormApplication {
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      id: "tokenflipper-emote-config",
      title: "TokenFlipper - Emote Configuration",
      template: `modules/${MODULE_ID}/templates/emote-config.html`,
      width: 650,
      height: "auto",
      closeOnSubmit: false,
      submitOnChange: true,
      resizable: true
    });
  }

  async getData(options = {}) {
    let emotes = game.settings.get(MODULE_ID, "emotes") || [];

    // Initialize defaults if empty and user is GM
    if (emotes.length === 0 && game.user.isGM) {
      emotes = getDefaultEmotes();
      await game.settings.set(MODULE_ID, "emotes", emotes);
      console.log(`${MODULE_ID} | Initialized default emotes from config form`);
    }

    console.log(`${MODULE_ID} | Loading ${emotes.length} emotes for config form`);

    return {
      emotes: emotes,
      isGM: game.user.isGM
    };
  }

  activateListeners(html) {
    super.activateListeners(html);

    // File picker buttons
    html.find(".file-picker-button").click(this._onFilePicker.bind(this));

    // Add new emote button
    html.find(".add-emote").click(this._onAddEmote.bind(this));

    // Delete emote buttons
    html.find(".delete-emote").click(this._onDeleteEmote.bind(this));

    // Create macro buttons
    html.find(".create-macro").click(this._onCreateMacro.bind(this));

    // Preview emote buttons
    html.find(".preview-emote").click(this._onPreviewEmote.bind(this));

    // Reset to defaults button
    html.find(".reset-defaults").click(this._onResetDefaults.bind(this));
  }

  async _onFilePicker(event) {
    event.preventDefault();
    const button = event.currentTarget;
    // Get the sibling input within the same form-fields container
    const input = button.closest(".form-fields").querySelector("input[type='text']");

    const fp = new FilePicker({
      type: "image",
      current: input.value,
      callback: (path) => {
        input.value = path;
        this._onSubmit(event);
      }
    });
    fp.browse();
  }

  async _onAddEmote(event) {
    event.preventDefault();
    const emotes = game.settings.get(MODULE_ID, "emotes") || [];

    // Generate unique ID
    const id = `emote-${Date.now()}`;

    emotes.push({
      id: id,
      name: "New Emote",
      image: "",
      offsetX: 0,
      offsetY: -20,
      scale: 1.0,
      duration: 1500,
      fadeIn: 200,
      fadeOut: 200
    });

    await game.settings.set(MODULE_ID, "emotes", emotes);
    this.render();
  }

  async _onDeleteEmote(event) {
    event.preventDefault();
    const emoteId = event.currentTarget.dataset.emoteId;

    const confirmed = await Dialog.confirm({
      title: "Delete Emote",
      content: "<p>Are you sure you want to delete this emote?</p>"
    });

    if (!confirmed) return;

    const emotes = game.settings.get(MODULE_ID, "emotes") || [];
    const filtered = emotes.filter(e => e.id !== emoteId);
    await game.settings.set(MODULE_ID, "emotes", filtered);
    this.render();
  }

  async _onCreateMacro(event) {
    event.preventDefault();
    const emoteId = event.currentTarget.dataset.emoteId;
    const emotes = game.settings.get(MODULE_ID, "emotes") || [];
    const emote = emotes.find(e => e.id === emoteId);

    if (emote) {
      await createEmoteMacro(emote);
    }
  }

  async _onPreviewEmote(event) {
    event.preventDefault();
    const emoteId = event.currentTarget.dataset.emoteId;

    if (canvas.tokens.controlled.length === 0) {
      ui.notifications.warn("Select a token to preview the emote.");
      return;
    }

    playEmote(emoteId);
  }

  async _onResetDefaults(event) {
    event.preventDefault();

    const confirmed = await Dialog.confirm({
      title: "Reset to Defaults",
      content: "<p>This will replace all current emotes with the default set. Are you sure?</p>"
    });

    if (!confirmed) return;

    const defaults = getDefaultEmotes();
    await game.settings.set(MODULE_ID, "emotes", defaults);
    ui.notifications.info("Emotes reset to defaults.");
    this.render();
  }

  async _updateObject(event, formData) {
    const emotes = game.settings.get(MODULE_ID, "emotes") || [];

    // Parse the flat form data back into emote objects
    const expandedData = foundry.utils.expandObject(formData);

    if (expandedData.emotes) {
      for (const [index, data] of Object.entries(expandedData.emotes)) {
        const i = parseInt(index);
        if (emotes[i]) {
          emotes[i].name = data.name || emotes[i].name;
          emotes[i].image = data.image || emotes[i].image;
          emotes[i].offsetX = parseInt(data.offsetX) || 0;
          emotes[i].offsetY = parseInt(data.offsetY) || 0;
          emotes[i].scale = parseFloat(data.scale) || 1.0;
          emotes[i].duration = parseInt(data.duration) || 1500;
          emotes[i].fadeIn = parseInt(data.fadeIn) || 200;
          emotes[i].fadeOut = parseInt(data.fadeOut) || 200;
        }
      }
    }

    await game.settings.set(MODULE_ID, "emotes", emotes);
  }
}

/**
 * Register the emote configuration menu
 */
export function registerEmoteConfigMenu() {
  game.settings.registerMenu(MODULE_ID, "emoteConfig", {
    name: "Configure Emotes",
    label: "Configure Emotes",
    hint: "Add, edit, and manage token emote animations.",
    icon: "fas fa-comment-dots",
    type: EmoteConfigForm,
    restricted: true
  });
}
