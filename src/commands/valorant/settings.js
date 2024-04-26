const {
    ChatInputCommandInteraction,
    SlashCommandBuilder,
    ApplicationCommandOptionType,
  } = require("discord.js");

const {handleSettingsViewCommand, handleSettingsSetCommand, settingsChoices} = require("@helpers/Valorant");


/**
 * @type {import("@structures/Command")}
 */
module.exports = {
  name: "settings",
  description: "Change your settings with the bot, or view your current settings!",
  category: "VALORANT",
  // botPermissions: ["EmbedLinks"],
  // command: {
  //   enabled: true,
  //   usage: "[command]",
  // },
  slashCommand: {
    enabled: true,
    options: [
      {
        name: "view",
        description: "See your current settings",
        type: ApplicationCommandOptionType.Subcommand,
        options: [],
      },
      {
        name: "set",
        description: "Change one of your settings with the bot",
        type: ApplicationCommandOptionType.Subcommand,
        options: [
          {
            name: "setting",
            description: "The name of the setting you want to change",
            type: ApplicationCommandOptionType.String,
            required: true,
            choices: settingsChoices,
          },
        ],
      },
    ],
  },

  async messageRun(message, args, data) {
      //nix
  },

  async interactionRun(interaction, client) {
    // const sub = interaction.options.getSubcommand();

    // switch (sub) {
    //   case "view":
    //     await handleSettingsViewCommand(interaction);
    //     break;

    //   case "set":
    //     await handleSettingsSetCommand(interaction);
    //     break;
    // }

    switch (interaction.options.getSubcommand()) {
      case "view": return await handleSettingsViewCommand(interaction);
      case "set": return await handleSettingsSetCommand(interaction);
  }
    
}

}