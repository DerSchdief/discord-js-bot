const {
    ApplicationCommandType,
    EmbedBuilder,
    ButtonBuilder,
    ButtonStyle,
  } = require("discord.js");
const prettyMs = require("pretty-ms");
const { EMBED_COLORS, MUSIC } = require("@root/config");
const { SpotifyItemType } = require("@lavaclient/spotify");

const search_prefix = {
  YT: "ytsearch",
  YTM: "ytmsearch",
  SC: "scsearch",
};


/**
* @type {import("@structures/BaseModal")}
*/
module.exports = {
    id: "playModal2",
    description: "Play Modal",
    type: ApplicationCommandType.User,
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
async function play({ member, guild, channel }, query) {
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
  
    let player = guild.client.musicManager.getPlayer(guild.id);
    if (player && !guild.members.me.voice.channel) {
      player.disconnect();
      await guild.client.musicManager.destroyPlayer(guild.id);
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
  
    try {
      if (guild.client.musicManager.spotify.isSpotifyUrl(query)) {
        if (!MUSIC.SPOTIFY_CLIENT_ID || !MUSIC.SPOTIFY_CLIENT_SECRET) {
          const embedErrorNoSpotify = new EmbedBuilder()
            .setColor(client.config.EMBED_COLORS.ERROR)
            .setAuthor({name: "Error"})
            .setDescription("🚫 Spotify songs cannot be played. Please contact the bot owner")
          return { embeds: [embedErrorNoSpotify] };
        }
  
        const item = await guild.client.musicManager.spotify.load(query);
        switch (item?.type) {
          case SpotifyItemType.Track: {
            const track = await item.resolveYoutubeTrack();
            tracks = [track];
            description = `[${track.info.title}](${track.info.uri})`;
            break;
          }
  
          case SpotifyItemType.Artist:
            tracks = await item.resolveYoutubeTracks();
            description = `Artist: [**${item.name}**](${query})`;
            break;
  
          case SpotifyItemType.Album:
            tracks = await item.resolveYoutubeTracks();
            description = `Album: [**${item.name}**](${query})`;
            break;
  
          case SpotifyItemType.Playlist:
            tracks = await item.resolveYoutubeTracks();
            description = `Playlist: [**${item.name}**](${query})`;
            break;
  
          default:
            return { embeds: [embedDefaultCaseError] };
        }
  
        if (!tracks) guild.client.logger.debug({ query, item });
      } else {
        const res = await guild.client.musicManager.rest.loadTracks(
          /^https?:\/\//.test(query) ? query : `${search_prefix[MUSIC.DEFAULT_SOURCE]}:${query}`
        );
        switch (res.loadType) {
          case "LOAD_FAILED":
            guild.client.logger.error("Search Exception", res.exception);
            const embedSearchError = new EmbedBuilder()
              .setColor(client.config.EMBED_COLORS.ERROR)
              .setAuthor({name: "Error"})
              .setDescription("🚫 There was an error while searching")
            return { embeds: [embedSearchError] };
  
          case "NO_MATCHES":
            const embedNoResultsError = new EmbedBuilder()
              .setColor(client.config.EMBED_COLORS.ERROR)
              .setAuthor({name: "Error"})
              .setDescription(`No results found matching ${query}`)
            return { embeds: [embedNoResultsError] };
  
          case "PLAYLIST_LOADED":
            tracks = res.tracks;
            description = res.playlistInfo.name;
            break;
  
          case "TRACK_LOADED":
          case "SEARCH_RESULT": {
            const [track] = res.tracks;
            tracks = [track];
            break;
          }
  
          default:
            guild.client.logger.debug("Unknown loadType", res);
            return { embeds: [embedDefaultCaseError] };
        }
  
        if (!tracks) guild.client.logger.debug({ query, res });
      }
    } catch (error) {
        guild.client.logger.error("Search Exception", error);
        return { embeds: [embedDefaultCaseError] };
    }
  
    if (!tracks) {
      embed.setAuthor({name: "Error"}).setDescription("Error");
      return {embeds: [embed] };
    }//return "🚫 An error occurred while searching for the song";
  
    if (tracks.length === 1) {
      // const track = tracks[0];
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
          value: "`" + prettyMs(track.info.length, { colonNotation: true }) + "`",
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
  
    // create a player and/or join the member's vc
    if (!player?.connected) {
      player = guild.client.musicManager.createPlayer(guild.id);
      player.queue.data.channel = channel;
      player.connect(member.voice.channel.id, { deafened: true });
    }
  
    // do queue things
    const started = player.playing || player.paused;
    player.queue.add(tracks, { requester: member.user.tag, next: false });
    if (!started) {
      await player.queue.start();
    }
  
    return { embeds: [embed] };
  }
  