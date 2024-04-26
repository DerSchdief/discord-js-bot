const {
    Client,
    ChatInputCommandInteraction,
    EmbedBuilder,
    ChannelType,
    ActionRowBuilder,
    ButtonBuilder,
    ApplicationCommandType,
    MessageFlagsBitField,
  } = require("discord.js");

const {
    basicEmbed, s, removeAlert, getSkin, fetchChannel, skinNameAndEmoji,
    removeAlertActionRow
} = require("@helpers/Valorant");

/**
* @type {import("@structures/BaseButton")}
*/
module.exports = {
    id: "removealert",
    description: "Remove Alert Button",
    type: ApplicationCommandType.User,
    category: "VALORANT",
    enabled: true,
    ephemeral: false,
    options: true,
    userPermissions: [],
    cooldown: 0,
  
    async run(interaction) {
        const [, uuid, id] = interaction.customId.split('/');

        if(id !== interaction.user.id) return await interaction.reply({
            embeds: [basicEmbed(s(interaction).error.NOT_UR_ALERT)],
            ephemeral: true
        });

        const success = removeAlert(id, uuid);
        if(success) {
            const skin = await getSkin(uuid);

            const channel = interaction.channel || await fetchChannel(interaction.channelId);
            await interaction.update({
                embeds: [basicEmbed(s(interaction).info.ALERT_REMOVED.f({s: await skinNameAndEmoji(skin, channel, interaction)}))],
                ephemeral: true
            });

            if(interaction.message.flags.has(MessageFlagsBitField.Flags.Ephemeral)) return; // message is ephemeral


            if(interaction.message.interaction && interaction.message.interaction.commandName === "alert") { // if the message is the response to /alert
                await interaction.message.delete().catch(() => {});
            } else if(!interaction.message.interaction) { // the message is an automatic alert
                const actionRow = removeAlertActionRow(interaction.user.id, uuid, s(interaction).info.REMOVE_ALERT_BUTTON);
                actionRow.components[0].setDisabled(true).setLabel("Removed");

                await interaction.update({components: [actionRow]}).catch(() => {});
            }
        } else {
            await interaction.update({embeds: [basicEmbed(s(interaction).error.GHOST_ALERT)], ephemeral: true});
        }
    },
  };
  