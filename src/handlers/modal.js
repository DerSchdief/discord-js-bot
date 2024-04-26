const { parsePermissions } = require("@helpers/Utils");
const { timeformat } = require("@helpers/Utils");

const cooldownCache = new Map();

module.exports = {
  /**
   * @param {import('discord.js').ModalSubmitInteraction} interaction
   */
  handleModal: async function (interaction) {

    if (interaction.client.config.BOT_SETTINGS.MAINTENANCEMODE) {
      if (!interaction.client.config.OWNER_IDS.some(owner => owner.id === interaction.user.id)) {
        return interaction.reply({
          content: `Aktuell laufen Wartungsarbeiten, daher stehen alle Funktionen nur den Bot-Ownern zur Verfügung`,
          ephemeral: true,
        });
      }
    }

    const modal = interaction.client.modals.get(interaction.customId);

    if (!modal) return;
  
    if (modal == undefined) return;

    // check cooldown
    if (modal.cooldown) {
      const remaining = getRemainingCooldown(interaction.user.id, modal);
      if (remaining > 0) {
        return interaction.reply({
          content: `You are on cooldown. You can again use the command after ${timeformat(remaining)}`,
          ephemeral: true,
        });
      }
    }

    // check user permissions
    if (interaction.member && modal.userPermissions && modal.userPermissions?.length > 0) {
      if (!interaction.member.permissions.has(modal.userPermissions)) {
        return interaction.reply({
          content: `You need ${parsePermissions(modal.userPermissions)} for this command`,
          ephemeral: true,
        });
      }
    }

    try {
      // if(!interaction.deferred) await interaction.deferReply({ ephemeral: button.ephemeral });
      
      await modal.run(interaction);
    } catch (ex) {
      interaction.followUp("Oops! An error occurred while running the command");
      interaction.client.logger.error("modalRun", ex);
    } 
    // finally {
    //   applyCooldown(interaction.user.id, button);
    // }
  },
};

/**
 * @param {string} memberId
 * @param {object} modal
 */
function applyCooldown(memberId, modal) {
  const key = modal.name + "|" + memberId;
  cooldownCache.set(key, Date.now());
}

/**
 * @param {string} memberId
 * @param {object} modal
 */
function getRemainingCooldown(memberId, modal) {
  const key = modal.name + "|" + memberId;
  if (cooldownCache.has(key)) {
    const remaining = (Date.now() - cooldownCache.get(key)) * 0.001;
    if (remaining > modal.cooldown) {
      cooldownCache.delete(key);
      return 0;
    }
    return modal.cooldown - remaining;
  }
  return 0;
}

