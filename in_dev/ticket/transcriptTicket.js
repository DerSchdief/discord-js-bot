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
  id: "transcriptTicket",
  developer: false,

  async execute(interaction, client) {
    const { channel, member, guild, customId } = interaction;
  },
};
