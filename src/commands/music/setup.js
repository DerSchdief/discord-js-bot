const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const fs = require('fs');

/**
 * @type {import("@structures/Command")}
 */
module.exports = {
    name: "setup",
    description: "Setup music bot",
    category: "MUSIC",
    botPermissions: ["EmbedLinks"],
    slashCommand: {
      enabled: true,
    },

    async messageRun(message, args) {
    },

    async interactionRun(interaction) {
        const commandChannel = interaction.channel;

        const controlRow1 = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('play')
                    .setLabel('▶️ Play')
                    .setStyle(ButtonStyle.Primary),
                new ButtonBuilder()
                    .setCustomId('pause')
                    .setLabel('⏸️ Pause')
                    .setStyle(ButtonStyle.Secondary),
                new ButtonBuilder()
                    .setCustomId('next')
                    .setLabel('⏭️ Next')
                    .setStyle(ButtonStyle.Secondary),
                new ButtonBuilder()
                    .setCustomId('loop')
                    .setLabel('🔁 Loop')
                    .setStyle(ButtonStyle.Secondary),
            );

        const controlRow2 = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('stop')
                    .setLabel('📛 Stop')
                    .setStyle(ButtonStyle.Danger),
                new ButtonBuilder()
                    .setCustomId('queue')
                    .setLabel('🎶 Queue')
                    .setStyle(ButtonStyle.Secondary),
                new ButtonBuilder()
                    .setCustomId('nowplaying')
                    .setLabel('🎵 Now playing')
                    .setStyle(ButtonStyle.Secondary),
                new ButtonBuilder()
                    .setCustomId('volume')
                    .setLabel('🎶 Volume')
                    .setStyle(ButtonStyle.Success),
            );

        // & Button Guide: https://discordjs.guide/interactions/buttons.html#button-guide

        const controlerEmbed = new EmbedBuilder()
            .setTitle('🎶 Controler')
            .setDescription('Use the buttons below to control the music bot.')
            .setColor('#6104b9')
            .addFields(
                { name: '▶️ Play', value: 'Play the music', inline: true },
                { name: '⏸️ Pause', value: 'Pause the music', inline: true },
                { name: '⏭️ Next', value: 'Skip to the next song', inline: true },
                { name: '🔁 Loop', value: 'Loop the music', inline: true },
                { name: '📛 Stop', value: 'Stop the music', inline: true },
                { name: '🎶 Queue', value: 'Show the queue', inline: true },
                { name: '🎵 Now playing', value: 'Show the nowplaying', inline: true },
                { name: '🎶 Volume', value: 'Change Volume of the Bot', inline: true },
                { name: '📌 Important', value: 'In this channel you can\'t talk. Use the buttons to control the music bot.' }
            )
            .setFooter({ text: interaction.client.user.username, iconURL: interaction.client.user.avatarURL({ dynamic: true }) })
            .setTimestamp();

        // & Embed Guide: https://discordjs.guide/popular-topics/embeds.html#embed-preview

        await interaction.followUp({ embeds: [controlerEmbed], components: [controlRow1, controlRow2] });
        //await interaction.reply({});
       // await interaction.editReply({ content: `✅ Successfully setup the music bot!\n\n🎶 Category: ${category}\n🎶 Controler: ${controler}\n🎶 Voice Channels: ${musicVoiceChannels.map(channel => `<#${channel}>`).join(', ')}`, ephemeral: true });
    }
}