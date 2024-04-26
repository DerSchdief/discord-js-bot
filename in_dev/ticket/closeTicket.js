const {
  Client,
  ChatInputCommandInteraction,
  EmbedBuilder,
  ChannelType,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require("discord.js");
const { Types } = require("mongoose");

const guildTicketDB = require("../../schemas/tickets/guildTicketDB");
const userTicketDB = require("../../schemas/tickets/userTicketDB");

const { createTranscript } = require("discord-html-transcripts");

module.exports = {
  id: "closeTicket",
  developer: false,

  async execute(interaction, client) {
    const { channel, member, guild, customId } = interaction;

    const ticketsData = await guildTicketDB.findOne({
      guildId: guild.id,
    });
    const usersData = await userTicketDB.findOne({
      guildId: guild.id,
      ticketId: channel.id,
    });

    if (!member.roles.cache.find((r) => r.id === ticketsData.supportId)) {
      return await interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setColor("Red")
            .setDescription(`You're not allowed to use this button.`),
        ],
        ephemeral: true,
      });
    }

    if (usersData.closed === true)
      return await interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setDescription("The ticket is already closed.")
            .setColor("0x2F3136"),
        ],
      });

    await userTicketDB.updateMany(
      {
        ticketId: channel.id,
      },
      {
        closed: true,
        closer: member.id,
      }
    );

    if (!usersData.closer == member.id)
      return await interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setDescription("You are not the user that closed this ticket!")
            .setColor("Red"),
        ],
        ephemeral: true,
      });

    client.channels.cache
      .get(usersData.ticketId)
      .permissionOverwrites.edit(usersData.creatorId, {
        ViewChannel: false,
      });

    await interaction.reply({
      embeds: [
        new EmbedBuilder()
          .setColor("Blue")
          .setTitle("Ticket Closed")
          .setDescription(
            "The ticket has been closed, the user who created this ticket cannot see it now!"
          )
          .addFields(
            {
              name: "Ticket Creator",
              value: `<@${usersData.creatorId}> created this ticket.`,
            },
            {
              name: "Ticket Closer",
              value: `<@${member.user.id}> closed this ticket.`,
            },
            {
              name: "Closed at",
              value: `${new Date().toLocaleString()}`,
            }
          )
          .setFooter({
            text: `${client.user.tag} by Schdief Community lan!`,
            iconURL: client.user.displayAvatarURL(),
          }),
      ],
      components: [
        new ActionRowBuilder().setComponents(
          new ButtonBuilder()
            .setCustomId("reopenTicket")
            .setEmoji("🔓")
            .setLabel("Reopen")
            .setStyle(ButtonStyle.Primary),
          new ButtonBuilder()
            .setCustomId("deleteTicket")
            .setEmoji("⛔")
            .setLabel("Delete")
            .setStyle(ButtonStyle.Danger)
        ),
      ],
    });
  },
};
