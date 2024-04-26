const { parsePermissions } = require("@helpers/Utils");
const { timeformat } = require("@helpers/Utils");

const cooldownCache = new Map();

module.exports = {
  /**
   * @param {import('discord.js').ButtonInteraction} interaction
   */
  handleSelectMenu: async function (interaction) {
    // let name = "";

    // if (interaction.values[0].startsWith("levels") || interaction.values[0].startsWith("chromas")) {
    //   // const [btn] = interaction.customId.split('/');
    //   name = "get-level-video";
    // } else {
    //   name = interaction.customId;
    // }

    // const selectMenu = interaction.client.selectMenus.get(name);

    if (interaction.client.config.BOT_SETTINGS.MAINTENANCEMODE) {
      console.log("Wartungsarbeiten aktiv")
      if (!interaction.client.config.OWNER_IDS.some(owner => owner.id === interaction.user.id)) {
        return interaction.reply({
          content: `Aktuell laufen Wartungsarbeiten, daher stehen alle Funktionen nur den Bot-Ownern zur Verfügung`,
          ephemeral: true,
        });
      }
    }

    const selectMenu = interaction.client.selectMenus.get(interaction.customId);

    if (!selectMenu) return;
  
    if (selectMenu == undefined) return;

    // check cooldown
    if (selectMenu.cooldown) {
      const remaining = getRemainingCooldown(interaction.user.id, selectMenu);
      if (remaining > 0) {
        return interaction.reply({
          content: `You are on cooldown. You can again use the command after ${timeformat(remaining)}`,
          ephemeral: true,
        });
      }
    }

    // check user permissions
    if (interaction.member && selectMenu.userPermissions && selectMenu.userPermissions?.length > 0) {
      if (!interaction.member.permissions.has(selectMenu.userPermissions)) {
        return interaction.reply({
          content: `You need ${parsePermissions(selectMenu.userPermissions)} for this command`,
          ephemeral: true,
        });
      }
    }

    try {
      // if(!interaction.deferred) await interaction.deferReply({ ephemeral: selectMenu.ephemeral });
      
      await selectMenu.run(interaction);
    } catch (ex) {
      // interaction.followUp("Oops! An error occurred while running the command");
      interaction.reply({
        content: `Oops! An error occurred while running the command`,
        ephemeral: true,
      });
      interaction.client.logger.error("selectMenuRun", ex);
    } 
    // finally {
    //   applyCooldown(interaction.user.id, button);
    // }
  },
};

/**
 * @param {string} memberId
 * @param {object} selectMenu
 */
function applyCooldown(memberId, selectMenu) {
  const key = selectMenu.name + "|" + memberId;
  cooldownCache.set(key, Date.now());
}

/**
 * @param {string} memberId
 * @param {object} selectMenu
 */
function getRemainingCooldown(memberId, selectMenu) {
  const key = selectMenu.name + "|" + memberId;
  if (cooldownCache.has(key)) {
    const remaining = (Date.now() - cooldownCache.get(key)) * 0.001;
    if (remaining > selectMenu.cooldown) {
      cooldownCache.delete(key);
      return 0;
    }
    return button.cooldown - remaining;
  }
  return 0;
}
