const { parsePermissions } = require("@helpers/Utils");
const { timeformat } = require("@helpers/Utils");

const cooldownCache = new Map();

module.exports = {
  /**
   * @param {import('discord.js').ButtonInteraction} interaction
   */
  handleButton: async function (interaction) {
    
    if (interaction.client.config.BOT_SETTINGS.MAINTENANCEMODE) {
      if (!interaction.client.config.OWNER_IDS.some(owner => owner.id === interaction.user.id)) {
        return interaction.reply({
          content: `Aktuell laufen Wartungsarbeiten, daher stehen alle Funktionen nur den Bot-Ownern zur Verfügung`,
          ephemeral: true,
        });
      }
    }

    let name = "";

    if(interaction.customId.includes('/')) {
      // const [btn] = interaction.customId.split('/');
      [name] = interaction.customId.split('/');
    } else {
      name = interaction.customId;
    }

    const button = interaction.client.buttons.get(name);

    

    // check cooldown
    if (button.cooldown) {
      const remaining = getRemainingCooldown(interaction.user.id, button);
      if (remaining > 0) {
        return interaction.reply({
          content: `You are on cooldown. You can again use the command after ${timeformat(remaining)}`,
          ephemeral: true,
        });
      }
    }

    // check user permissions
    if (interaction.member && button.userPermissions && button.userPermissions?.length > 0) {
      if (!interaction.member.permissions.has(button.userPermissions)) {
        return interaction.reply({
          content: `You need ${parsePermissions(button.userPermissions)} for this command`,
          ephemeral: true,
        });
      }
    }

    try {
      // if(!interaction.deferred) await interaction.deferReply({ ephemeral: button.ephemeral });
      
      await button.run(interaction);
    } catch (ex) {
      // interaction.followUp("Oops! An error occurred while running the command");
      interaction.reply({
        content: "Oops! An error occurred while running the command",
        ephemeral: true,
      });
      interaction.client.logger.error("buttonRun", ex);
    } 
    // finally {
    //   applyCooldown(interaction.user.id, button);
    // }
  },
};

/**
 * @param {string} memberId
 * @param {object} button
 */
function applyCooldown(memberId, button) {
  const key = button.name + "|" + memberId;
  cooldownCache.set(key, Date.now());
}

/**
 * @param {string} memberId
 * @param {object} button
 */
function getRemainingCooldown(memberId, button) {
  const key = button.name + "|" + memberId;
  if (cooldownCache.has(key)) {
    const remaining = (Date.now() - cooldownCache.get(key)) * 0.001;
    if (remaining > button.cooldown) {
      cooldownCache.delete(key);
      return 0;
    }
    return button.cooldown - remaining;
  }
  return 0;
}
