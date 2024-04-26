const {
    ActionRowBuilder,
    StringSelectMenuBuilder,
    ApplicationCommandOptionType,
  } = require("discord.js");

const {
        getUser, basicEmbed, s, renderProfile, getAccountInfo, getSetting,
    } = require("@helpers/Valorant");

module.exports = {
    name: "profile",
    description: "Check your VALORANT profile",
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
            name: "user",
            description: "Optional: see someone else's profile!",
            required: false,
            type: ApplicationCommandOptionType.User,
        },
        ],
    },

    async messageRun(message, args, data) {
        //nix
    },

    async interactionRun(interaction, client) {

        let targetUser = interaction.user;
        const valorantUser = getUser(interaction.user.id);

        const otherUser = interaction.options.getUser("user");
        if (otherUser && otherUser.id !== interaction.user.id) {
            const otherValorantUser = getUser(otherUser.id);
            if (!otherValorantUser) return await interaction.followUp({
                embeds: [basicEmbed(s(interaction).error.NOT_REGISTERED_OTHER)]
            });

            if (!getSetting(otherUser.id, "othersCanViewProfile")) return await interaction.followUp({
                embeds: [basicEmbed(s(interaction).error.OTHER_PROFILE_DISABLED.f({ u: `<@${otherUser.id}>` }))]
            });

            targetUser = otherUser;
        }
        else if (!valorantUser) return await interaction.followUp({
            embeds: [basicEmbed(s(interaction).error.NOT_REGISTERED)],
            ephemeral: true
        });

        const user = getUser(targetUser.id)
        const message = await renderProfile(interaction, await getAccountInfo(user, interaction), targetUser.id);

        await interaction.followUp(message);

        interaction.client.logger.debug(`Sent ${targetUser.tag}'s profile!`); // also logged if maintenance/login failed


    }
  }