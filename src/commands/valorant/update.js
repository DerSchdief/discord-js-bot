const {
    
  } = require("discord.js");

const {
        getUser, basicEmbed, s, authUser, authFailureMessage, 
        getUserInfo, getRegion, saveUser
    } = require("@helpers/Valorant");

/**
 * @type {import("@structures/Command")}
 */
module.exports = {
    name: "update",
    description: "Update your username/region in the bot.",
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

    async messageRun(message, args, data) {
        //nix
    },

    async interactionRun(interaction, client) {
        const valorantUser = getUser(interaction.user.id);

        if (!valorantUser) return await interaction.followup({
            embeds: [basicEmbed(s(interaction).error.NOT_REGISTERED)],
            ephemeral: true,
        });

        const id = interaction.user.id;
        const authSuccess = await authUser(id);
        if (!authSuccess.success) return await interaction.followUp(authFailureMessage(interaction, authSuccess, s(interaction).error.AUTH_ERROR_GENERIC));

       let user = getUser(id);
       interaction.client.logger.debug(`Refreshing username & region for ${user.username}...`);

       const [userInfo, region] = await Promise.all([
           getUserInfo(user),
           getRegion(user)
       ]);

       user.username = userInfo.username;
       user.region = region;
       user.lastFetchedData = Date.now();
       saveUser(user);

       await interaction.followup({
           embeds: [basicEmbed(s(interaction).info.ACCOUNT_UPDATED.f({u: user.username}, interaction))],
       });
    }
  }