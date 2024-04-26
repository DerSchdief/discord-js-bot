const { ApplicationCommandType, } = require("discord.js");
const { 
        basicEmbed, getSkin, alertExists, removeAlertActionRow, skinNameAndEmoji, skinChosenEmbed, addAlert, s
    } = require("@helpers/Valorant");

/**
* @type {import("@structures/BaseSelectMenu")}
*/
module.exports = {
    id: "skin-select",
    description: "Skin Select Menu",
    type: ApplicationCommandType.User,
    enabled: true,
    ephemeral: false,
    options: true,
    userPermissions: [],
    cooldown: 0,

    async run(interaction) {
        if (interaction.message.interaction.user.id !== interaction.user.id) {
            return await interaction.reply({
                embeds: [basicEmbed(s(interaction).error.NOT_UR_MESSAGE_ALERT)],
                ephemeral: true
            });
        }

        const chosenSkin = interaction.values[0].substr(5);
        const skin = await getSkin(chosenSkin);

        const otherAlert = alertExists(interaction.user.id, chosenSkin);
        if (otherAlert) return await interaction.reply({
            embeds: [basicEmbed(s(interaction).error.DUPLICATE_ALERT.f({ s: await skinNameAndEmoji(skin, interaction.channel, interaction), c: otherAlert.channel_id }))],
            components: [removeAlertActionRow(interaction.user.id, otherAlert.uuid, s(interaction).info.REMOVE_ALERT_BUTTON)],
            ephemeral: true
        });

        addAlert(interaction.user.id, {
            id: interaction.user.id,
            uuid: chosenSkin,
            channel_id: interaction.channelId
        });

        await interaction.update({
            embeds: [await skinChosenEmbed(interaction, skin)],
            components: [removeAlertActionRow(interaction.user.id, chosenSkin, s(interaction).info.REMOVE_ALERT_BUTTON)]
        });
    },
};
