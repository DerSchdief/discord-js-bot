const { EmbedBuilder, AttachmentBuilder } = require("discord.js");
const { profileImage } = require("discord-arts");

/**
 * @param {import('discord.js').GuildMember} member
 * @param {import('discord.js').ChatInputCommandInteraction} interaction
 */
module.exports = async (interaction) => {
// module.exports = async (member, interaction) => {

  let targetUser = interaction.options.getUser("name") || interaction.user;
  const member = await interaction.guild.members.fetch(targetUser);

  let color = member.displayHexColor;
  if (color === "#000000") color = interaction.client.config.EMBED_COLORS.BOT_EMBED;

  const fetchedMembers = await interaction.guild.members.fetch();

  const profileBuffer = await profileImage(member.id);
  const imageAttachment = new AttachmentBuilder(profileBuffer, { name: 'profile.png' });

  // const topRoles = "Hallo"
  const topRoles = member.roles.cache
  .sort((a, b) => b.position - a.position)
  .map(role => role)
  .slice(0, 5);

  // const joinPosition = "1";
  const joinPosition = Array.from(fetchedMembers
  .sort((a, b) => a.joinedTimestamp - b.joinedTimestamp)
  .keys())
  .indexOf(member.id) + 1;

  const userBadges = member.user.flags.toArray();
  userBadges.sort((a, b) => a - b);

  const joinTime = parseInt(member.joinedTimestamp / 1000 );
  const createdTime = parseInt(member.user.createdTimestamp / 1000);

  // const Booster = member.premiumSince ? "<:discordboost:1112569025654951966>" : "❌";
  const Booster = parseInt(member.premiumSinceTimestamp / 1000);

  let arrayFlags = [];

  member.user.flags.toArray().forEach(async (flag) => {
    arrayFlags.push(flag);
  });

  if(member.user.bot) {
    const botData = await fetch(
      `https://discord.com/api/v10/applications/${member.user.id}/rpc`
    );
  
    const json = await botData.json();
    let botFlags = json.flags;

    const gateways = {
      ApplicationCommand: 1 << 23,
    };

    if(!arrayFlags.includes("VerifiedBot")) {
      const botNoVerif = "NotVerifiedBot";
      arrayFlags.push(botNoVerif);
    }

    for (let i in gateways) {
      const bit = gateways[i];
      if ((botFlags & bit) === bit) arrayFlags.push(i);
    }
  } else {
    const userData = await fetch(`https://japi.rest/discord/v1/user/${member.user.id}`);
    const { data } = await userData.json();

    if(data.public_flags_array.includes("NITRO")) {
      arrayFlags.push("Nitro");
    }

    if(Booster) {
      arrayFlags.push("Booster");
    }
  }

  const badgeOrder = {
    "Staff": 0,
    "Partner": 1,
    "CertifiedModerator": 2,
    "Hypesquad": 3,
    "HypeSquadOnlineHouse3": 4,
    "HypeSquadOnlineHouse1": 5,
    "HypeSquadOnlineHouse2": 6,
    "BugHunterLevel1": 7,
    "BugHunterLevel2": 8,
    "ActiveDeveloper": 9,
    "VerifiedDeveloper": 10,
    "PremiumEarlySupporter": 11,
    "Nitro": 12,
    "Booster": 13,
    "BOOSTER_2": 14,
    "BOOSTER_3": 15,
    "BOOSTER_6": 16,
    "BOOSTER_9": 17,
    "BOOSTER_12": 18,
    "BOOSTER_15": 19,
    "BOOSTER_18": 20,
    "BOOSTER_24": 21,
    "ApplicationCommand": 22,
    "VerifiedBot": 23,
    "NotVerifiedBot": 24
  };
  
  arrayFlags = arrayFlags.sort(
    (a, b) => badgeOrder[a] - badgeOrder[b]
  );

  // console.log(arrayFlags);

  // const Embed = new EmbedBuilder()
  //   .setAuthor({name: `${member.user.tag} | Information`,  iconURL: member.displayAvatarURL()})
  //   .setColor(color)
  //   .setThumbnail(member.user.displayAvatarURL())
  //   .setDescription(`On <t:${joinTime}:D>, ${member.user.username} joined as the **${joinPosition}.** Member of this Discord`)
  //   .setImage("attachment://profile.png")
  //   .addFields(
  //     {name: "Badges", value: `${addBadges(userBadges).join("")}`, inline: true},
  //     {name: "Booster", value: `${Booster}`, inline: true},
  //     {name: "Top Roles", value: `${topRoles.join("").replace(`<@${interaction.guildId}>`)}`, inline: false},
  //     {name: "Created", value: `<t:${createdTime}:R>`, inline: true},
  //     {name: "Joined", value: `<t:${joinTime}:R>`, inline: true},
  //     {name: "Identifier", value: `${member.id}`, inline: false},
  //     {name: "Avatar", value: `[LINK](${member.displayAvatarURL()})`, inline: true},
  //     {name: "Banner", value: `[LINK](${(await member.user.fetch()).bannerURL()})`, inline: true},
  //   )
  //   .setFooter({ text: `Requested by ${interaction.user.tag}` })
  //   .setTimestamp(Date.now());

  const Embed = new EmbedBuilder()
    .setAuthor({name: `${member.user.tag}`,  iconURL: member.displayAvatarURL()})
    .setTitle("User Infomation")
    .setColor(color)
    .setThumbnail(member.user.displayAvatarURL())
    // .setDescription(`On <t:${joinTime}:D>, ${member.user.username} joined as the **${joinPosition}.** Member of this Discord`)
    .setImage("attachment://profile.png")
    .addFields(
      {name: "Username", value: `<@${member.id}>`, inline: false},
      // {name: "Badges", value: `${addBadges(userBadges).join("")}`, inline: false},
      {name: "Badges", value: `${addBadges(arrayFlags).join("")}`, inline: false},
      {name: "Top Roles", value: `${topRoles.join("").replace(`<@${interaction.guildId}>`)}`, inline: false},
      // {name: "Booster2", value: `<t:${Booster2}:R>`, inline: false},
      // {name: "Booster3", value: `${Booster3}`, inline: false},
      // {name: "Booster", value: `${Booster}`, inline: true},
      // {name: "Created", value: `<t:${createdTime}:R>`, inline: true},
      // {name: "Joined", value: `<t:${joinTime}:R>`, inline: true},
    )
    // .setFooter({ text: `Requested by ${interaction.user.tag}` })
    .setTimestamp(Date.now());
      
      if(Booster === 0) {
        Embed.addFields(
          {name: "Joined Server", value: `<t:${joinTime}:R>`, inline: true},
          {name: "Created", value: `<t:${createdTime}:R>`, inline: true},
        )
      } else {
        Embed.addFields(
          {name: "Booster", value: `<t:${Booster}:R>`, inline: true},
          {name: "Joined Server", value: `<t:${joinTime}:R>`, inline: true},
          {name: "Created", value: `<t:${createdTime}:R>`, inline: true},
        )
      }

  return { embeds: [Embed], files: [imageAttachment] };
};

function addBadges(badgeNames) {
  if(!badgeNames.length) return ["X"];
  const badgeMap = {
      "ActiveDeveloper": "<:activedeveloper:1114564194331791490>",
      "BugHunterLevel1": "<:discordbughunter1:1114564199230750801>",
      "BugHunterLevel2": "<:discordbughunter2:1114564201495662703>",
      "PremiumEarlySupporter": "<:discordearlysupporter:1114564203009818625>",
      "Partner": "<:discordpartner:1114564207921336381>",
      "Staff": "<:discordstaff:1114564210190454904>",
      "HypeSquadOnlineHouse1": "<:hypesquadbravery:1114564212186955846>", // bravery
      "HypeSquadOnlineHouse2": "<:hypesquadbrilliance:1114564269997039777>", // brilliance
      "HypeSquadOnlineHouse3": "<:hypesquadbalance:1114564268424175686>", // balance
      "Hypesquad": "<:hypesquadevents:1114564272282943558>",
      "CertifiedModerator": "<:discordmod:1114564205371199498>",
      "VerifiedDeveloper": "<:discordbotdev:1114564197855019108>",
      "Nitro": "<:discordnitro:1114564206621110343>",
      "ApplicationCommand": "<:slashBot:1115435447359918190>",
      "VerifiedBot": "<:botVerfi:1115435445766078585>",
      "NotVerifiedBot": "<:botNoVerfi:1115435443534704710>",
      "Booster": "<:discordboost7:1114564195682373642>",
  };

  // return badgeNames.map(badgeName => badgeMap[badgeName] || '❔');
  return badgeNames.map(badgeName => badgeMap[badgeName]);
};

function titleCase(string){
  return string[0].toUpperCase() + string.slice(1).toLowerCase();
}