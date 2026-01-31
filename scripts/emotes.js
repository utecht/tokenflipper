const MODULE_ID = "tokenflipper";

// Track active emote sprites to prevent duplicates
const activeEmotes = new Map();

/**
 * Initialize socket listeners for emote synchronization
 */
export function initializeEmoteSockets() {
  game.socket.on(`module.${MODULE_ID}`, (data) => {
    if (data.action === "playEmote") {
      renderEmoteLocally(data.sceneId, data.tokenId, data.emoteId);
    }
  });
}

/**
 * Play an emote on the selected token(s)
 * @param {string} emoteId - The ID of the emote to play
 */
export async function playEmote(emoteId) {
  const controlled = canvas.tokens.controlled;

  if (controlled.length === 0) {
    ui.notifications.warn("No tokens selected for emote.");
    return;
  }

  const emotes = game.settings.get(MODULE_ID, "emotes") || [];
  const emote = emotes.find(e => e.id === emoteId);

  if (!emote) {
    ui.notifications.error(`Emote "${emoteId}" not found.`);
    return;
  }

  for (const token of controlled) {
    if (!token.document.isOwner) {
      ui.notifications.warn(`You don't have permission to emote with ${token.name}.`);
      continue;
    }

    // Play locally
    renderEmoteLocally(canvas.scene.id, token.id, emoteId);

    // Broadcast to other clients
    game.socket.emit(`module.${MODULE_ID}`, {
      action: "playEmote",
      sceneId: canvas.scene.id,
      tokenId: token.id,
      emoteId: emoteId
    });
  }
}

/**
 * Render an emote sprite locally on a token
 * @param {string} sceneId - The scene ID
 * @param {string} tokenId - The token ID
 * @param {string} emoteId - The emote ID
 */
async function renderEmoteLocally(sceneId, tokenId, emoteId) {
  // Only render if we're on the same scene
  if (canvas.scene?.id !== sceneId) return;

  const token = canvas.tokens.get(tokenId);
  if (!token) return;

  const emotes = game.settings.get(MODULE_ID, "emotes") || [];
  const emote = emotes.find(e => e.id === emoteId);
  if (!emote) return;

  // Create unique key for this emote instance
  const emoteKey = `${tokenId}-${emoteId}`;

  // If this emote is already playing on this token, skip
  if (activeEmotes.has(emoteKey)) return;

  try {
    // Load the texture
    const texture = await loadTexture(emote.image);
    if (!texture) {
      console.warn(`${MODULE_ID} | Failed to load emote texture: ${emote.image}`);
      return;
    }

    // Create the sprite
    const sprite = new PIXI.Sprite(texture);
    sprite.anchor.set(0.5, 1.0); // Bottom-center anchor for "above head" positioning
    sprite.scale.set(emote.scale || 1.0);
    sprite.alpha = 0;

    // Position relative to token center
    const tokenCenterX = token.x + (token.w / 2);
    const tokenTopY = token.y;
    sprite.position.set(
      tokenCenterX + (emote.offsetX || 0),
      tokenTopY + (emote.offsetY || 0)
    );

    // Add to canvas
    canvas.tokens.addChild(sprite);
    activeEmotes.set(emoteKey, sprite);

    // Animate: fade in
    await animateSprite(sprite, { alpha: 1 }, emote.fadeIn || 200);

    // Hold for duration
    await wait(emote.duration || 1500);

    // Animate: fade out
    await animateSprite(sprite, { alpha: 0 }, emote.fadeOut || 200);

    // Cleanup
    canvas.tokens.removeChild(sprite);
    sprite.destroy();
    activeEmotes.delete(emoteKey);

  } catch (error) {
    console.error(`${MODULE_ID} | Error playing emote:`, error);
    activeEmotes.delete(emoteKey);
  }
}

/**
 * Animate a sprite's properties
 * @param {PIXI.Sprite} sprite - The sprite to animate
 * @param {Object} properties - Properties to animate (e.g., { alpha: 1 })
 * @param {number} duration - Duration in milliseconds
 */
function animateSprite(sprite, properties, duration) {
  return new Promise((resolve) => {
    if (duration <= 0) {
      Object.assign(sprite, properties);
      resolve();
      return;
    }

    const animations = [];
    for (const [key, value] of Object.entries(properties)) {
      animations.push({
        parent: sprite,
        attribute: key,
        to: value
      });
    }

    CanvasAnimation.animate(animations, {
      duration: duration,
      easing: "easeOutQuad"
    }).then(resolve);
  });
}

/**
 * Wait for a specified duration
 * @param {number} ms - Milliseconds to wait
 */
function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Get the default emotes configuration
 * @returns {Array} Default emotes array
 */
export function getDefaultEmotes() {
  return [
    {
      id: "exclamation",
      name: "Exclamation",
      image: `modules/${MODULE_ID}/assets/exclamation.svg`,
      offsetX: 0,
      offsetY: -20,
      scale: 0.75,
      duration: 1500,
      fadeIn: 200,
      fadeOut: 200
    },
    {
      id: "question",
      name: "Question",
      image: `modules/${MODULE_ID}/assets/question.svg`,
      offsetX: 0,
      offsetY: -20,
      scale: 0.75,
      duration: 1500,
      fadeIn: 200,
      fadeOut: 200
    },
    {
      id: "ellipsis",
      name: "Thinking",
      image: `modules/${MODULE_ID}/assets/ellipsis.svg`,
      offsetX: 0,
      offsetY: -20,
      scale: 0.75,
      duration: 2000,
      fadeIn: 200,
      fadeOut: 200
    },
    {
      id: "heart",
      name: "Heart",
      image: `modules/${MODULE_ID}/assets/heart.svg`,
      offsetX: 0,
      offsetY: -20,
      scale: 0.75,
      duration: 1500,
      fadeIn: 200,
      fadeOut: 200
    }
  ];
}

/**
 * Create a macro for an emote
 * @param {Object} emote - The emote configuration
 */
export async function createEmoteMacro(emote) {
  const command = `game.modules.get("${MODULE_ID}").api.playEmote("${emote.id}");`;

  const existingMacro = game.macros.find(m => m.name === `Emote: ${emote.name}`);
  if (existingMacro) {
    ui.notifications.info(`Macro "Emote: ${emote.name}" already exists.`);
    return existingMacro;
  }

  const macro = await Macro.create({
    name: `Emote: ${emote.name}`,
    type: "script",
    command: command,
    img: emote.image,
    flags: {
      [MODULE_ID]: { emoteId: emote.id }
    }
  });

  ui.notifications.info(`Created macro "Emote: ${emote.name}". Drag it to your hotbar!`);
  return macro;
}
