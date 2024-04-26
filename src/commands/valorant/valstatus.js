const {
    
  } = require("discord.js");

const {fetchMaintenances, defer, valMaintenancesEmbeds, getUser} = require("@helpers/Valorant");

/**
 * @type {import("@structures/Command")}
 */
module.exports = {
  name: "valstatus",
  description: "Check the status of your account's VALORANT servers",
  category: "VALORANT",
  // botPermissions: ["EmbedLinks"],
  // command: {
  //   enabled: true,
  //   usage: "[command]",
  // },
  slashCommand: {
    enabled: true,
    options: [],
  },

    async interactionRun(interaction, client) {
        const valorantUser = getUser(interaction.user.id);

        const json = await fetchMaintenances(valorantUser.region);
        await interaction.followUp(valMaintenancesEmbeds(interaction, json));
    }
  }