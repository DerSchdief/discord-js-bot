const {
    ApplicationCommandOptionType,
  } = require("discord.js");

// const { createJoinToCreate } = require("@schemas/JoinToCreate");

/**
 * @type {import("@structures/Command")}
 */
module.exports = {
    name: "jointocreate",
    description: "Wähle den JoinToCreate Channel",
    category: "OWNER",
    command: {
      enabled: false,
    },
    slashCommand: {
      enabled: false,
      ephemeral: true,
      options: [
        {
          name: "channel",
          description: "Wähle den JoinToCreate Channel",
          type: ApplicationCommandOptionType.Channel,
          required: true,
          channel_types: [2],
        },
        {
            name: "userlimit",
            description: "Mit welchem Userlimit sollen neue Channels erstellt werden?",
            type: ApplicationCommandOptionType.Integer,
            required: true,
            minValue: 0,
            maxValue: 99,
          },
      ],
    },
  
    // async messageRun(message, args) {
    // },
  
    async interactionRun(interaction) {
        const channel = interaction.options.getChannel("channel")
        const userlimit = interaction.options.getInteger("userlimit");
        const response = await jointocreate(interaction, channel, userlimit);
        await interaction.followUp(response);
    },
};

/**
 * @param {import("discord.js").CommandInteraction|import("discord.js").Message} arg0
 */
async function jointocreate({ guild, options }, channel, userlimit) {
    // await createJoinToCreate(guild, channel, userlimit);
    return `Der Channel ${channel.name} wurde als JoinToCreate-Channel hinterlegt`

    // console.log(`JoinToCreate Data ${joinToCreate}`);
    // console.log(`GuildID: ${guild.id}, ChannelID: ${channel.id}`);

    // const embed = new EmbedBuilder()
    //     .setAuthor({ name: "📤 Output" })
    //     .setDescription("test")
    //     .setColor("Random");

    // return { embeds: [embed] };

    
  }