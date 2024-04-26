const {
    EmbedBuilder,
    PermissionFlagsBits,
    ApplicationCommandType,
  } = require("discord.js");
  
  module.exports = {
    id: "searchModal",
    description: "Play Modal",
    type: ApplicationCommandType.User,
    enabled: true,
    ephemeral: false,
    options: true,
    userPermissions: [],
    cooldown: 0,
  
    async execute(interaction, client) {
        const searchName = interaction.fields.getTextInputValue('searchInput');
            
        const search = await client.distube.search(searchName, { limit: 10, type: 'video' });

        const nameReplace = searchName.replace(/ /g, '+');

        const embed = new EmbedBuilder()
            .setTitle('🔍 Youtube Search')
            .setURL(`https://www.youtube.com/results?search_query=${nameReplace}`)
            .setDescription(`**Name:** ${searchName}`)
            .setColor('#6104b9')
            .setImage(search[0].thumbnail)
            .setFooter({ text: `Requested by ${interaction.user.tag}`, iconURL: interaction.user.avatarURL({ dynamic: true }) })
            .setTimestamp();
            
        for (let i = 0; i < search.length; i++) {
            embed.addFields({ name: `${i + 1}. ${search[i].name}`, value: `**Channel:** ${search[i].uploader.name}\n**Link:** ${search[i].url}` });
        }

        await interaction.reply({ embeds: [embed], ephemeral: true });
    },
  };
  