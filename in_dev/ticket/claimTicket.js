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

// const guildTicketDB = require("../../schemas/tickets/guildTicketDB");
// const userTicketDB = require("../../schemas/tickets/userTicketDB");

const { createTranscript } = require("discord-html-transcripts");

module.exports = {
  id: "claimTicket",
  developer: false,

  async execute(interaction) {
    // const { channel, member, guild, customId } = interaction;

    // const ticketDat = await guildTicketDB.findOne({
    //   guildId: guild.id,
    // });
    // const userDat = await userTicketDB.findOne({
    //   guildId: guild.id,
    //   ticketId: channel.id,
    // });

    // if (userDat.claimed === true)
    //   return await interaction.reply({
    //     embeds: [
    //       new EmbedBuilder()
    //         .setColor("Red")
    //         .setDescription(`Ticket has been claimed already.`),
    //     ],
    //     ephemeral: true,
    //   });

    // if (!member.roles.cache.find((r) => r.id === ticketDat.supportId))
    //   return await interaction.reply({
    //     embeds: [
    //       new EmbedBuilder()
    //         .setColor("Red")
    //         .setDescription(`Your not allowed to use this button.`),
    //     ],
    //     ephemeral: true,
    //   });

    // await userTicketDB.updateMany(
    //   {
    //     ticketId: channel.id,
    //   },
    //   {
    //     claimed: true,
    //     claimer: member.id,
    //   }
    // );

    // await interaction.reply({
    //   embeds: [
    //     new EmbedBuilder()
    //       .setColor("Blue")
    //       .setDescription(`Ticket has been claimed`),
    //   ],
    //   ephemeral: true,
    // });
  },
};
