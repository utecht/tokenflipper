import { initializeEmoteSockets, playEmote, getDefaultEmotes, createEmoteMacro } from "./emotes.js";
import { registerEmoteConfigMenu } from "./emote-config.js";

const MODULE_ID = "tokenflipper";

Hooks.once("init", () => {
  // Register flip/bounce settings
  game.settings.register(MODULE_ID, "flipDuration", {
    name: "Flip Animation Duration",
    hint: "Duration of the flip animation in milliseconds. Set to 0 for instant flip.",
    scope: "client",
    config: true,
    type: Number,
    default: 200,
    range: {
      min: 0,
      max: 1000,
      step: 50
    }
  });

  game.settings.register(MODULE_ID, "bounceHeight", {
    name: "Bounce Height",
    hint: "How high tokens bounce when talking (in pixels).",
    scope: "client",
    config: true,
    type: Number,
    default: 20,
    range: {
      min: 5,
      max: 50,
      step: 5
    }
  });

  game.settings.register(MODULE_ID, "bounceDuration", {
    name: "Bounce Duration",
    hint: "Duration of each bounce in milliseconds.",
    scope: "client",
    config: true,
    type: Number,
    default: 150,
    range: {
      min: 50,
      max: 500,
      step: 25
    }
  });

  game.settings.register(MODULE_ID, "bounceCount", {
    name: "Bounce Count",
    hint: "Number of bounces when talking.",
    scope: "client",
    config: true,
    type: Number,
    default: 3,
    range: {
      min: 1,
      max: 6,
      step: 1
    }
  });

  // Register emotes setting (world-scoped, GM only)
  game.settings.register(MODULE_ID, "emotes", {
    name: "Emotes",
    hint: "Configured emote animations.",
    scope: "world",
    config: false,
    type: Array,
    default: []
  });

  // Register the emote configuration menu
  registerEmoteConfigMenu();

  // Register keybinding for horizontal flip
  game.keybindings.register(MODULE_ID, "flipHorizontal", {
    name: "Flip Token Horizontally",
    hint: "Flips the selected token(s) horizontally so they face the opposite direction.",
    editable: [{ key: "KeyF" }],
    onDown: () => {
      flipSelectedTokens("horizontal");
      return true;
    },
    precedence: CONST.KEYBINDING_PRECEDENCE.NORMAL
  });

  // Register keybinding for vertical flip
  game.keybindings.register(MODULE_ID, "flipVertical", {
    name: "Flip Token Vertically",
    hint: "Flips the selected token(s) vertically.",
    editable: [{ key: "KeyV", modifiers: ["Shift"] }],
    onDown: () => {
      flipSelectedTokens("vertical");
      return true;
    },
    precedence: CONST.KEYBINDING_PRECEDENCE.NORMAL
  });

  // Register keybinding for bounce/talk animation
  game.keybindings.register(MODULE_ID, "bounce", {
    name: "Bounce Token (Talk)",
    hint: "Makes the selected token(s) bounce like they're talking.",
    editable: [{ key: "KeyF", modifiers: ["Shift"] }],
    onDown: () => {
      bounceSelectedTokens();
      return true;
    },
    precedence: CONST.KEYBINDING_PRECEDENCE.NORMAL
  });
});

Hooks.once("ready", () => {
  // Initialize socket listeners for emotes
  initializeEmoteSockets();

  // Expose API for macros
  game.modules.get(MODULE_ID).api = {
    playEmote: playEmote,
    createEmoteMacro: createEmoteMacro,
    flipSelectedTokens: flipSelectedTokens,
    bounceSelectedTokens: bounceSelectedTokens
  };

  // Initialize default emotes if none exist (first run)
  initializeDefaultEmotes();

  console.log(`${MODULE_ID} | TokenFlipper v0.5 loaded - Press F to flip, Shift+F to bounce`);
});

/**
 * Initialize default emotes on first run
 */
async function initializeDefaultEmotes() {
  // Only GM can set world settings
  if (!game.user.isGM) return;

  const emotes = game.settings.get(MODULE_ID, "emotes");

  // Only initialize if empty (first run)
  if (emotes.length === 0) {
    const defaults = getDefaultEmotes();
    await game.settings.set(MODULE_ID, "emotes", defaults);
    console.log(`${MODULE_ID} | Initialized default emotes`);
  }
}

/**
 * Flip all currently selected tokens
 * @param {string} direction - "horizontal" or "vertical"
 */
async function flipSelectedTokens(direction) {
  const controlled = canvas.tokens.controlled;

  if (controlled.length === 0) {
    ui.notifications.warn("No tokens selected to flip.");
    return;
  }

  const property = direction === "vertical" ? "texture.scaleY" : "texture.scaleX";
  const duration = game.settings.get(MODULE_ID, "flipDuration");

  for (const token of controlled) {
    if (!token.document.isOwner) {
      ui.notifications.warn(`You don't have permission to flip ${token.name}.`);
      continue;
    }

    // Skip if token is currently animating
    if (token.animationContexts?.size > 0) continue;

    const currentValue = foundry.utils.getProperty(token.document, property);
    const updates = {};
    updates[property] = currentValue * -1;

    await token.document.update(updates, {
      animate: duration > 0,
      animation: { duration }
    });
  }
}

/**
 * Make all currently selected tokens bounce like they're talking
 */
async function bounceSelectedTokens() {
  const controlled = canvas.tokens.controlled;

  if (controlled.length === 0) {
    ui.notifications.warn("No tokens selected to bounce.");
    return;
  }

  const bounceHeight = game.settings.get(MODULE_ID, "bounceHeight");
  const bounceDuration = game.settings.get(MODULE_ID, "bounceDuration");
  const bounceCount = game.settings.get(MODULE_ID, "bounceCount");

  for (const token of controlled) {
    if (!token.document.isOwner) {
      ui.notifications.warn(`You don't have permission to bounce ${token.name}.`);
      continue;
    }

    // Skip if token is currently animating
    if (token.animationContexts?.size > 0) continue;

    // Run bounce animation
    doBounceAnimation(token, bounceHeight, bounceDuration, bounceCount);
  }
}

/**
 * Perform a bounce animation on a token
 * @param {Token} token - The token to animate
 * @param {number} height - Bounce height in pixels
 * @param {number} duration - Duration of each bounce in ms
 * @param {number} count - Number of bounces
 */
async function doBounceAnimation(token, height, duration, count) {
  const originalY = token.document.y;

  for (let i = 0; i < count; i++) {
    // Bounce up
    await token.document.update(
      { y: originalY - height },
      { animate: true, animation: { duration: duration / 2, easing: "easeOutQuad" } }
    );

    // Bounce down
    await token.document.update(
      { y: originalY },
      { animate: true, animation: { duration: duration / 2, easing: "easeInQuad" } }
    );
  }
}
