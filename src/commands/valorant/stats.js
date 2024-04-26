const {
    ActionRowBuilder,
    StringSelectMenuBuilder,
    ApplicationCommandOptionType,
  } = require("discord.js");

const {
        searchSkin, basicEmbed, s, getStatsFor, defer, statsForSkinEmbed, secondaryEmbed,
        allStatsEmbed, getOverallStats, l, discToValLang, DEFAULT_VALORANT_LANG, valNamesToDiscordNames
    } = require("@helpers/Valorant");

module.exports = {
    name: "stats",
    description: "See the stats for a skin!",
    category: "VALORANT",
    // botPermissions: ["EmbedLinks"],
    // command: {
    //   enabled: true,
    //   usage: "[command]",
    // },
    slashCommand: {
        enabled: true,
        options: [
        {
            name: "skin",
            description: "The name of the skin you want to see the stats of",
            required: false,
            autocomplete: true,
            type: ApplicationCommandOptionType.String,
        },
        ],
    },

    async messageRun(message, args, data) {
        //nix
    },


    async autocomplete(interaction) {
        const focusedValue = interaction.options.getFocused();
        const searchResults = await searchSkin(focusedValue, interaction.locale, 5);

        await interaction.respond(searchResults.map(result => ({
            name: result.obj.names[discToValLang[interaction.locale] || DEFAULT_VALORANT_LANG],
            value: result.obj.names[DEFAULT_VALORANT_LANG],
            // nameLocalizations: valNamesToDiscordNames(result.obj.names) // does this even work?
        })));
    },

    async interactionRun(interaction, client) {

        const skinName = (interaction.options.get("skin") || {}).value;

        if(skinName) {
            const skins = await searchSkin(skinName, interaction.locale, 25);

            if(skins.length === 0) {
                return await interaction.followUp({
                    embeds: [basicEmbed(s(interaction).error.SKIN_NOT_FOUND)]
                });
            } else if(skins.length === 1 ||
                l(skins[0].obj.names, interaction.locale).toLowerCase() === skinName.toLowerCase() ||
                l(skins[0].obj.names).toLowerCase() === skinName.toLowerCase()) {
                const skin = skins[0].obj;

                const stats = getStatsFor(skin.uuid);

                return await interaction.followUp({
                    embeds: [await statsForSkinEmbed(skin, stats, interaction)]
                });
            } else {
                const row = new ActionRowBuilder();
                const options = skins.map(result => {
                    return {
                        label: l(result.obj.names, interaction),
                        value: `skin-${result.obj.uuid}`
                    }
                });
                row.addComponents(new StringSelectMenuBuilder().setCustomId("skin-select-stats").setPlaceholder(s(interaction).info.ALERT_CHOICE_PLACEHOLDER).addOptions(options));

                await interaction.followUp({
                    embeds: [secondaryEmbed(s(interaction).info.STATS_CHOICE)],
                    components: [row]
                });
            }

        } else {
            await interaction.followUp(await allStatsEmbed(interaction, getOverallStats()));
        }

    }
  }