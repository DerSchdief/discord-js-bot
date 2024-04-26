const { parsePermissions } = require("@helpers/Utils");
const { timeformat } = require("@helpers/Utils");

const cooldownCache = new Map();

module.exports = {
  /**
   * @param {import('discord.js').AutocompleteInteraction} interaction
   */
  handleAutocomplete: async function (interaction) {
    // check cooldown
    const cmd = interaction.client.slashCommands.get(interaction.commandName);
    if (!cmd) return interaction.reply({ content: "An error has occurred", ephemeral: true }).catch(() => {});

    // callback validations
    if (cmd.validations) {
      for (const validation of cmd.validations) {
        if (!validation.callback(interaction)) {
          return interaction.reply({
            content: validation.message,
            ephemeral: true,
          });
        }
      }
    }

    try {
        // await interaction.deferReply({ ephemeral: cmd.slashCommand.ephemeral });
        // const settings = await getSettings(interaction.guild);
        await cmd.autocomplete(interaction);
    } catch (ex) {
        // await interaction.followUp("Oops! An error occurred while running the command");
        interaction.client.logger.error("interactionRun", ex);
    }
  },
};

