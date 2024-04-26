const {
    ApplicationCommandOptionType,
  } = require("discord.js");

const {defer, readUserJson, basicEmbed, s, loginUsernamePassword} = require("@helpers/Valorant");
const config = require("@root/config");

/**
 * @type {import("@structures/Command")}
 */
module.exports = {
  name: "login",
  description: "Valo Shop login",
  category: "VALORANT",
  // botPermissions: ["EmbedLinks"],
  // command: {
  //   enabled: true,
  //   usage: "[command]",
  // },
  slashCommand: {
    enabled: true,
    ephemeral: true,
    options: [
      {
        name: "username",
        description: "Valo Username",
        required: true,
        type: ApplicationCommandOptionType.String,
      },
      {
        name: "password",
        description: "Valo Passwort",
        required: true,
        type: ApplicationCommandOptionType.String,
      },
    ],
  },


  async messageRun(message, args, data) {
    //nix
  },

  async interactionRun(interaction) {
    const json = readUserJson(interaction.user.id);
    if (json && json.accounts.length >= config.maxAccountsPerUser) {
        return await interaction.followUp({
            embeds: [basicEmbed(s(interaction).error.TOO_MANY_ACCOUNTS.f({ n: config.maxAccountsPerUser }))]
        })
    }

    const username = interaction.options.get("username").value;
    const password = interaction.options.get("password").value;

    await loginUsernamePassword(interaction, username, password);
  }
}