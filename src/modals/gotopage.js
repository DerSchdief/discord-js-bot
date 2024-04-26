const {
    ApplicationCommandType,
    EmbedBuilder,
    ButtonBuilder,
    ButtonStyle,
  } = require("discord.js");

const {
  basicEmbed, alertsPageEmbed, allStatsEmbed, filteredAlertsForUser, getOverallStats,
  getLoadout, getUser, skinCollectionPageEmbed, authFailureMessage, collectionOfWeaponEmbed, getSkins
  } = require("@helpers/Valorant");


/**
* @type {import("@structures/BaseModal")}
*/
module.exports = {
    id: "gotopage",
    description: "gotopage Modal",
    type: ApplicationCommandType.User,
    enabled: true,
    ephemeral: false,
    options: true,
    userPermissions: [],
    cooldown: 0,
  
    async run(interaction) {
      const response = await gotopage(interaction);
      // await interaction.update(response); 
    },
};
  

/**
 * @param {import("discord.js").CommandInteraction|import("discord.js").Message} arg0
 */
async function gotopage(interaction) {
    let [, pageId, userId, max] = interaction.customId.split('/');
    let weaponTypeIndex
    if(pageId === 'clwpage') [, pageId, weaponTypeIndex, userId, max] = interaction.customId.split('/');
    const pageIndex = interaction.fields.getTextInputValue('pageIndex');

    if(isNaN(Number(pageIndex))){
        return await interaction.followUp({
            embeds: [basicEmbed(s(interaction).error.NOT_A_NUMBER)],
            ephemeral: true
        });
    }else if(Number(pageIndex) > max || Number(pageIndex) <= 0){
        return await interaction.followUp({
            embeds: [basicEmbed(s(interaction).error.INVALID_PAGE_NUMBER.f({max: max}))],
            ephemeral: true
        });
    }

    switch (pageId) {
        case "clpage": clpage(); break;
        case "clwpage": clwpage(); break;
        case "changealertspage": await interaction.update(await alertsPageEmbed(interaction, await filteredAlertsForUser(interaction), parseInt(pageIndex-1), await VPEmoji(interaction))); break;
        case "changestatspage": await interaction.update(await allStatsEmbed(interaction, await getOverallStats(), parseInt(pageIndex-1)));break;
    }

    
  }

async function clpage() {
    let user;
    if (userId !== interaction.user.id) user = getUser(userId);
    else user = valorantUser;

    const loadoutResponse = await getLoadout(user);
    if (!loadoutResponse.success) return await interaction.followUp(authFailureMessage(interaction, loadoutResponse, s(interaction).error.AUTH_ERROR_COLLECTION, userId !== interaction.user.id));

    await interaction.update(await skinCollectionPageEmbed(interaction, userId, user, loadoutResponse, parseInt(pageIndex-1)));
}

async function clwpage() {
    const weaponType = Object.values(WeaponTypeUuid)[parseInt(weaponTypeIndex)];

    let user;
    if (userId !== interaction.user.id) user = getUser(userId);
    else user = valorantUser;

    const skinsResponse = await getSkins(user);
    if (!skinsResponse.success) return await interaction.followUp(authFailureMessage(interaction, skinsResponse, s(interaction).error.AUTH_ERROR_COLLECTION, userId !== interaction.user.id));

    await interaction.update(await collectionOfWeaponEmbed(interaction, userId, user, weaponType, skinsResponse.skins, parseInt(pageIndex-1)));
}