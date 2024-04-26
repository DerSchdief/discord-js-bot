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
  id: "deleteTicket",
  developer: false,

  async execute(interaction, client) {
    const { channel, member, guild, customId } = interaction;

    const tksData = await guildTicketDB.findOne({
      guildId: guild.id,
    });
    const usrData = await userTicketDB.findOne({
      guildId: interaction.guild.id,
      ticketId: channel.id,
    });

    if (!member.roles.cache.find((r) => r.id === tksData.supportId)) {
      return await interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setColor("Red")
            .setDescription(`Your not allowed to use this button.`),
        ],
        ephemeral: true,
      });
    }

    interaction.message.edit({
      components: [
        new ActionRowBuilder().setComponents(
          new ButtonBuilder()
            .setCustomId("ticket-close")
            .setLabel("Close Ticket")
            .setStyle(ButtonStyle.Danger)
            .setDisabled(true)
        ),
      ],
    });

    userTicketDB
      .findOneAndDelete({
        guildId: guild.id,
      })
      .catch((err) => console.log(err));

    setTimeout(
      () => channel.delete().catch((err) => console.log(err)),
      5 * 1000
    );

    const transcript = await createTranscript(channel, {
      limit: -1,
      returnBuffer: false,
      fileName: `Ticket-${member.user.username}.html`,
    });

    await client.channels.cache
      .get(tksData.logsId)
      .send({
        embeds: [
          new EmbedBuilder()
            .setTitle("closed ticket.")
            .setDescription(`Transcript: (download)[${transcript}]`)
            .addFields(
              {
                name: "Closer",
                value: `<@${usrData.closer}>`,
              },
              {
                name: "Ticket Deleted By",
                value: `<@${member.user.id}>`,
              },
              {
                name: "Deleted At",
                value: `${new Date().toLocaleString()}`,
              }
            )
            .setColor("Blue"),
        ],
        files: [transcript],
      })
      .catch((err) => console.log(err));

    await interaction
      .reply({
        embeds: [
          new EmbedBuilder()
            .setTitle("closed ticket.")
            .setDescription(`Deleted by ${member.user.tag}`)
            .addFields({
              name: "Time",
              value: "Ticket will be Deleted in 5 seconds...",
            })
            .setColor("Blue"),
        ],
      })
      .catch((err) => console.log(err));
  },
};
