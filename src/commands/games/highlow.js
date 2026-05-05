// أعلى/أقل — توقّع الورقة التالية
const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { fmt, validateBet, saveUser, bumpStat, brandedEmbed, winEmbed, loseEmbed, balanceFooter, safeReply, CURRENCY } = require('../../utils/gameHelpers');
const { COLORS } = require('../../utils/embeds');

module.exports = {
  aliases: ['اعلى_اقل','highlow','hl'],
  data: new SlashCommandBuilder().setName('highlow').setDescription('🔼🔽 أعلى/أقل — هل الرقم التالي أعلى أم أقل؟')
    .addIntegerOption(o => o.setName('bet').setDescription('رهان').setMinValue(20).setRequired(true)),

  async execute(interaction) {
    const v = validateBet(interaction); if (!v.ok) return safeReply(interaction, { embeds:[v.errorEmbed], ephemeral:true });
    const { bet, g, u, guildId, userId } = v;
    let cur = Math.floor(Math.random()*100)+1;
    let mult = 1.0; let alive = true;
    const embed = (status='') => brandedEmbed(interaction, '🔼🔽 أعلى أم أقل', COLORS.cyan).setDescription(
      `🎲 الرقم الحالي: **${cur}**\n\n📈 المضاعف: **×${mult.toFixed(2)}**\n💰 الرهان: **${fmt(bet)}** ${CURRENCY}\n💵 الجائزة المحتملة: **${fmt(Math.floor(bet*mult))}** ${CURRENCY}\n\n${status}`
    );
    const row = () => new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('hl_high').setLabel('🔼 أعلى').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId('hl_low').setLabel('🔽 أقل').setStyle(ButtonStyle.Danger),
      new ButtonBuilder().setCustomId('hl_cash').setLabel('💵 صرف الجائزة').setStyle(ButtonStyle.Primary).setDisabled(mult <= 1)
    );
    u.balance -= bet; saveUser(guildId, g);
    const msg = await safeReply(interaction, { embeds:[embed('اضغط زراً للتنبؤ')], components:[row()] });
    const col = msg.createMessageComponentCollector({ filter: i => i.user.id === userId, time: 5*60*1000 });
    col.on('collect', async i => {
      if (!alive) return i.deferUpdate();
      if (i.customId === 'hl_cash') { alive = false; col.stop('cash'); return i.deferUpdate(); }
      const next = Math.floor(Math.random()*100)+1;
      const win = (i.customId === 'hl_high' && next > cur) || (i.customId === 'hl_low' && next < cur);
      if (next === cur) { mult *= 1.05; cur = next; await i.update({ embeds:[embed('🤝 نفس الرقم — مضاعف بسيط')], components:[row()] }).catch(()=>{}); return; }
      if (!win) { alive = false; col.stop('lose'); cur = next; await i.update({ embeds:[embed('💀 خطأ!')], components:[] }).catch(()=>{}); return; }
      mult *= cur > 50 || cur < 50 ? 1.4 : 1.6;
      cur = next;
      await i.update({ embeds:[embed('✅ صحيح!')], components:[row()] }).catch(()=>{});
    });
    col.on('end', async (_c, reason) => {
      bumpStat(u,'highlow_count');
      let payout = 0;
      if (reason === 'cash') { payout = Math.floor(bet * mult); u.balance += payout; bumpStat(u,'highlow_wins'); }
      saveUser(guildId, g);
      const fn = payout > bet ? winEmbed : loseEmbed;
      await interaction.editReply({ embeds:[fn(interaction, payout>0?'صرفت!':'انتهت', `الرقم الأخير: **${cur}**\nالمضاعف: **×${mult.toFixed(2)}**\n` + (payout?`💰 +${fmt(payout-bet)} ${CURRENCY}`:`💸 -${fmt(bet)} ${CURRENCY}`)).setFooter(balanceFooter(u))], components: [] }).catch(()=>{});
    });
  }
};
