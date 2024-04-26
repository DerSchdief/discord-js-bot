const {
    ApplicationCommandOptionType,
  } = require("discord.js");

const {
        getUser, basicEmbed, s, queueCookiesLogin, defer, waitForAuthQueueResponse, 
    } = require("@helpers/Valorant");

/**
 * @type {import("@structures/Command")}
 */
module.exports = {
    name: "cookies",
    description: "Log in with your cookies. Useful if you have 2FA or if you use Google/Facebook to log in.",
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
          name: "cookies",
          description: "Your auth.riotgames.com cookie header",
          required: true,
          type: ApplicationCommandOptionType.String,
        },
      ],
    },

    async messageRun(message, args, data) {
        //nix
    },

    async interactionRun(interaction) {

        // await defer(interaction, true);

        const cookies = interaction.options.get("cookies").value;

        let success = await queueCookiesLogin(interaction.user.id, cookies);
        if (success.inQueue) success = await waitForAuthQueueResponse(success);

        const user = getUser(interaction.user.id);
        let embed;
        if (success && user) {
            interaction.client.logger.debug(`${interaction.user.tag} logged in as ${user.username} using cookies`)
            embed = basicEmbed(s(interaction).info.LOGGED_IN.f({ u: user.username }));
        } else {
            interaction.client.logger.debug(`${interaction.user.tag} cookies login failed`);
            embed = basicEmbed(s(interaction).error.INVALID_COOKIES);
        }

        await interaction.followUp({
            embeds: [embed],
            ephemeral: true
        });
    }
  }