const {
  ApplicationCommandType,
  EmbedBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require("discord.js");
const prettyMs = require("pretty-ms");

const search_prefix = {
YT: "ytsearch",
YTM: "ytmsearch",
SC: "scsearch",
};


/**
* @type {import("@structures/BaseModal")}
*/
module.exports = {
  id: "playModal",
  description: "Play Modal",
  type: ApplicationCommandType.User,
  category: "MUSIC",
  enabled: true,
  ephemeral: false,
  options: true,
  userPermissions: [],
  cooldown: 0,

  async run(interaction) {
    const musicNameOrLink = interaction.fields.getTextInputValue('playInput');
    const response = await play(interaction, musicNameOrLink);
    await interaction.update(response); 
  },
};


/**
* @param {import("discord.js").CommandInteraction|import("discord.js").Message} arg0
* @param {string} query
*/
async function play({ client, member, guild, channel }, query) {
  if (!member.voice.channel) {
    const embedJoinFirst = new EmbedBuilder()
      .setColor(client.config.EMBED_COLORS.ERROR)
      .setAuthor({name: "Error"})
      .setDescription("🚫 You need to join a voice channel first")
    return { embeds: [embedJoinFirst] };
  }

  const embedDefaultCaseError = new EmbedBuilder()
    .setColor(client.config.EMBED_COLORS.ERROR)
    .setAuthor({name: "Error"})
    .setDescription("🚫 An error occurred while searching for the song")

  let player = guild.client.lavalink.getPlayer(guild.id);
  if (player && !guild.members.me.voice.channel) {
    player.disconnect();
    await guild.client.lavalink.destroyPlayer(guild.id);
  }

  if (player && member.voice.channel !== guild.members.me.voice.channel) {
    const embedSameVcAsMe = new EmbedBuilder()
      .setColor(client.config.EMBED_COLORS.ERROR)
      .setAuthor({name: "Error"})
      .setDescription("🚫 You must be in the same voice channel as mine")
    return { embeds: [embedSameVcAsMe] };
  }

  let embed = new EmbedBuilder().setColor(client.config.EMBED_COLORS.BOT_EMBED);
  let tracks;
  let description = "";

  const connected = player?.connected;

  // create a player and/or join the member's vc
  if (!connected) {
    player = await guild.client.lavalink.createPlayer({
      guildId: guild.id, 
      voiceChannelId: member.voice.channelId, 
      textChannelId: channel.id, 
      selfDeaf: true, 
      selfMute: false,
      volume: 15,  // default volume
      repeatMode: "off", //RepeatMode: "queue" | "track" | "off";
      instaUpdateFiltersFix: true, // optional
      applyVolumeAsFilter: false, // if true player.setVolume(54) -> player.filters.setVolume(0.54)
      node: "oryzen",
      // vcRegion: (interaction.member as GuildMember)?.voice.channel?.rtcRegion!
    }); 
    await player.connect();
  }

  try {
    const res = await player.search({
      query: query,
      // source: `Spotify`,
    }, member.user);
    ////"track" | "playlist" | "search" | "error" | "empty";
      switch (res.loadType) {
        case "error":
          guild.client.logger.error("Search Exception", res.exception);
          const embedSearchError = new EmbedBuilder()
            .setColor(client.config.EMBED_COLORS.ERROR)
            .setAuthor({name: "Error"})
            .setDescription("🚫 There was an error while searching")
          return { embeds: [embedSearchError] };

        case "empty":
          const embedNoResultsError = new EmbedBuilder()
            .setColor(client.config.EMBED_COLORS.ERROR)
            .setAuthor({name: "Error"})
            .setDescription(`No results found matching ${query}`)
          return { embeds: [embedNoResultsError] };

        case "playlist":
          tracks = res.tracks;
          description = res.playlistInfo.name;
          break;

        case "track":
        case "search": {
          const [track] = res.tracks;
          tracks = [track];
          break;
        }

        default:
          guild.client.logger.debug("Unknown loadType", res);
          return { embeds: [embedDefaultCaseError] };
      }

      if (!tracks) guild.client.logger.debug({ query, res });
  } catch (error) {
      guild.client.logger.error("Search Exception", error);
      return { embeds: [embedDefaultCaseError] };
  }


  if (!tracks) {
    embed.setAuthor({name: "Error"}).setDescription("Error");
    return {embeds: [embed] };
  }//return "🚫 An error occurred while searching for the song";

  if (tracks.length === 1) {
    const track = tracks[0];
    if (!player?.playing && !player?.paused && !player?.queue.tracks.length) {
      embed.setAuthor({ name: "Added Track to queue" });
    } else {
      const fields = [];
      embed
        .setAuthor({ name: "Added Track to queue" })
        .setDescription(`[${track.info.title}](${track.info.uri})`)
        .setFooter({ text: `Requested By: ${member.user.tag}` });

      fields.push({
        name: "Song Duration",
        value: "`" + prettyMs(track.info.duration, { colonNotation: true }) + "`",
        inline: true,
      });

      if (player?.queue?.tracks?.length > 0) {
        fields.push({
          name: "Position in Queue",
          value: (player.queue.tracks.length + 1).toString(),
          inline: true,
        });
      }
      embed.addFields(fields);
    }
  } else {
    embed
      .setAuthor({ name: "Added Playlist to queue" })
      .setDescription(description)
      .addFields(
        {
          name: "Enqueued",
          value: `${tracks.length} songs`,
          inline: true,
        },
        {
          name: "Playlist duration",
          value:
            "`" +
            prettyMs(
              tracks.map((t) => t.info.length).reduce((a, b) => a + b, 0),
              { colonNotation: true }
            ) +
            "`",
          inline: true,
        }
      )
      .setFooter({ text: `Requested By: ${member.user.tag}` });
  }

  // do queue things
  const started = player.playing || player.paused;
  player.queue.add(tracks);
  if (!started) {
    await player.play(connected ? { volume: 100, paused: false } : undefined);
  }

  return { embeds: [embed] };
}
