const {
    ApplicationCommandOptionType,
  } = require("discord.js");

const {
        getUser, basicEmbed, s, login2FA, defer,
    } = require("@helpers/Valorant");

/**
 * @type {import("@structures/Command")}
 */
module.exports = {
    name: "2fa",
    description: "Enter your 2FA code if needed",
    category: "VALORANT",
    // botPermissions: ["EmbedLinks"],
    // command: {
    //     enabled: false,
    //     usage: "[command]",
    // },
    slashCommand: {
        enabled: true,
        options: [
        {
            name: "code",
            description: "The 2FA Code",
            required: true,
            type: ApplicationCommandOptionType.String,
        },
        ],
    },

    async messageRun(message, args, data) {
        //nix
    },

    async interactionRun(interaction) {
        const valorantUser = getUser(interaction.user.id);

        if (!valorantUser || !valorantUser.auth || !valorantUser.auth.waiting2FA) return await interaction.reply({
            embeds: [basicEmbed(s(interaction).error.UNEXPECTED_2FA)],
            ephemeral: true
        });

        const code = interaction.options.get("code").value.toString().padStart(6, '0');

        await login2FA(interaction, code);
    }
  }