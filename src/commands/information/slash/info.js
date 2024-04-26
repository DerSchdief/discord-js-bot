const user = require("../shared/user");
const channelInfo = require("../shared/channel");
const guildInfo = require("../shared/guild");
const avatar = require("../shared/avatar");
const emojiInfo = require("../shared/emoji");
const botInfo = require("../shared/botstats");
const { ApplicationCommandOptionType } = require("discord.js");

/**
 * @type {import("@structures/Command")}
 */
module.exports = {
  name: "info",
  description: "show various information",
  category: "INFORMATION",
  botPermissions: ["EmbedLinks"],
  command: {
    enabled: false,
  },
  slashCommand: {
    enabled: true,
    ephemeral: true,
    options: [
      {
        name: "user",
        description: "get user information",
        type: ApplicationCommandOptionType.Subcommand,
        options: [
          {
            name: "name",
            description: "name of the user",
            type: ApplicationCommandOptionType.User,
            required: false,
          },
        ],
      },
      {
        name: "channel",
        description: "get channel information",
        type: ApplicationCommandOptionType.Subcommand,
        options: [
          {
            name: "name",
            description: "name of the channel",
            type: ApplicationCommandOptionType.Channel,
            required: false,
          },
        ],
      },
      {
        name: "guild",
        description: "get guild information",
        type: ApplicationCommandOptionType.Subcommand,
      },
      {
        name: "bot",
        description: "get bot information",
        type: ApplicationCommandOptionType.Subcommand,
      },
      {
        name: "avatar",
        description: "displays avatar information",
        type: ApplicationCommandOptionType.Subcommand,
        options: [
          {
            name: "name",
            description: "name of the user",
            type: ApplicationCommandOptionType.User,
            required: false,
          },
        ],
      },
      {
        name: "emoji",
        description: "displays emoji information",
        type: ApplicationCommandOptionType.Subcommand,
        options: [
          {
            name: "name",
            description: "name of the emoji",
            type: ApplicationCommandOptionType.String,
            required: true,
          },
        ],
      },
    ],
  },

  async interactionRun(interaction) {
    const sub = interaction.options.getSubcommand();
    if (!sub) return interaction.followUp("Not a valid subcommand");
    let response;

    // user
    if (sub === "user") {
      response = await user(interaction);
    }

    // channel
    else if (sub === "channel") {
      response = channelInfo(interaction);
    }

    // guild
    else if (sub === "guild") {
      response = await guildInfo(interaction);
    }

    // bot
    else if (sub === "bot") {
      response = botInfo(interaction);
    }

    // avatar
    else if (sub === "avatar") {
      response = avatar(interaction);
    }

    // emoji
    else if (sub === "emoji") {
      response = emojiInfo(interaction);
    }

    // return
    else {
      response = "Incorrect subcommand";
    }

    await interaction.followUp(response);
  },
};
