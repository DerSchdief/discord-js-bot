const { EmbedBuilder, ButtonBuilder, ActionRowBuilder, ButtonStyle, ComponentType } = require("discord.js");
const { EMBED_COLORS } = require("@root/config");


/**
 * @type {import("@structures/Command")}
 */
module.exports = {
  name: "reload",
  description: "Reload",
  category: "OWNER",
  command: {
    enabled: false,
  },
  slashCommand: {
    enabled: true,
    ephemeral: true,
    options: [
      // {
      //   name: "channel",
      //   description: "Wähle den JoinToCreate Channel",
      //   type: ApplicationCommandOptionType.Channel,
      //   required: true,
      //   channel_types: [2],
      // },
      // {
      //     name: "userlimit",
      //     description: "Mit welchem Userlimit sollen neue Channels erstellt werden?",
      //     type: ApplicationCommandOptionType.Integer,
      //     required: true,
      //     minValue: 0,
      //     maxValue: 99,
      //   },
    ],
  },

  // async messageRun(message, args) {
   
  // },

  async interactionRun(interaction) {
  //   const channel = interaction.options.getChannel("channel")
  //   const userlimit = interaction.options.getInteger("userlimit");
    const response = await reload(interaction);
    await interaction.followUp(response);
  },
};

/**
 * @param {import("discord.js").CommandInteraction|import("discord.js").Message} arg0
 */
async function reload({client, user}) {
  const embedReload = new EmbedBuilder()

  // await console.log("Alte Commands");
  // await console.log(client.slashCommands);

  if (client.config.INTERACTIONS.SLASH || client.config.INTERACTIONS.CONTEXT) {
    if (client.config.INTERACTIONS.GLOBAL) {
      client.loadConfig("/src/config");
      await client.slashCommands.clear();
      await client.loadCommands("src/commands");
      await client.registerInteractions();
      embedReload
        .setAuthor({ name: "📤 Reload" })
        .setDescription("Alle befehle wurden neu geladen!")
        .setColor(client.config.EMBED_COLORS.BOT_EMBED);
    } else {
      embedReload
        .setAuthor({ name: "ERROR" })
        .setDescription("🚫 Befehle werden nicht GLOBAL registriert")
        .setColor(client.config.EMBED_COLORS.ERROR);
    }
    // else await client.registerInteractions(client.config.INTERACTIONS.TEST_GUILD_ID);
  } else {
    embedReload
        .setDescription("🚫 SlashCommands sind nicht aktiv")
        .setColor(client.config.EMBED_COLORS.ERROR);
  }
      // console.log(client.slashCommands);

      // client.slashCommands.clear();
      // client.slashCommands.set("test", "test");

      // console.log("Neue Commands!")
      // console.log(client.slashCommands);

  return { embeds: [embedReload] };

  
}