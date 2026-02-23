import express from "express";
import { createServer as createViteServer } from "vite";
import { Telegraf, Markup } from "telegraf";
import db from "./src/db.ts";
import dotenv from "dotenv";

dotenv.config();

// Global Error Handlers to prevent crashes
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception thrown:', err);
});

const app = express();
const PORT = 3000;

// --- Express API Router ---
const apiRouter = express.Router();
apiRouter.use(express.json());

apiRouter.get("/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

apiRouter.get("/leads", (req, res) => {
  try {
    const leads = db.prepare('SELECT * FROM leads ORDER BY created_at DESC').all();
    res.json(leads);
  } catch (error) {
    console.error("Error fetching leads:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

apiRouter.get("/stats", (req, res) => {
  try {
    const totalLeads = db.prepare('SELECT COUNT(*) as count FROM leads').get() as any;
    const newLeads = db.prepare("SELECT COUNT(*) as count FROM leads WHERE status = 'new'").get() as any;
    const byRole = db.prepare('SELECT role, COUNT(*) as count FROM leads GROUP BY role').all();
    const byStatus = db.prepare('SELECT status, COUNT(*) as count FROM leads GROUP BY status').all();
    const overTime = db.prepare(`
      SELECT date(created_at) as date, COUNT(*) as count 
      FROM leads 
      WHERE created_at > date('now', '-30 days')
      GROUP BY date(created_at)
      ORDER BY date ASC
    `).all();
    
    res.json({ 
      total: totalLeads?.count || 0, 
      new: newLeads?.count || 0,
      byRole,
      byStatus,
      overTime
    });
  } catch (error) {
    console.error("Error fetching stats:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

apiRouter.post("/leads/:id/notes", (req, res) => {
  const { id } = req.params;
  const { notes } = req.body;
  try {
    db.prepare('UPDATE leads SET notes = ? WHERE id = ?').run(notes, id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: "Failed to update notes" });
  }
});

apiRouter.post("/leads/:id/status", (req, res) => {
  const { id } = req.params;
  const { status } = req.body;
  try {
    db.prepare('UPDATE leads SET status = ? WHERE id = ?').run(status, id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: "Failed to update status" });
  }
});

apiRouter.post("/leads/:id/assign", (req, res) => {
  const { id } = req.params;
  const { admin_id } = req.body;
  try {
    db.prepare('UPDATE leads SET assigned_to = ? WHERE id = ?').run(admin_id, id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: "Failed to assign lead" });
  }
});

apiRouter.get("/admins", (req, res) => {
  try {
    const admins = db.prepare('SELECT * FROM admins').all();
    res.json(admins);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch admins" });
  }
});

apiRouter.post("/admins", (req, res) => {
  const { telegram_id, username } = req.body;
  try {
    db.prepare('INSERT OR REPLACE INTO admins (telegram_id, username) VALUES (?, ?)').run(telegram_id, username);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: "Failed to add admin" });
  }
});

apiRouter.delete("/admins/:id", (req, res) => {
  const { id } = req.params;
  try {
    db.prepare('DELETE FROM admins WHERE telegram_id = ?').run(id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: "Failed to delete admin" });
  }
});

// --- FAQ API ---
apiRouter.get("/faq", (req, res) => {
  try {
    const faqs = db.prepare('SELECT * FROM faq ORDER BY id ASC').all();
    res.json(faqs);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch FAQ" });
  }
});

apiRouter.post("/faq", (req, res) => {
  const { question, answer, slug } = req.body;
  try {
    db.prepare('INSERT OR REPLACE INTO faq (question, answer, slug) VALUES (?, ?, ?)').run(question, answer, slug);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: "Failed to save FAQ" });
  }
});

apiRouter.delete("/faq/:id", (req, res) => {
  const { id } = req.params;
  try {
    db.prepare('DELETE FROM faq WHERE id = ?').run(id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: "Failed to delete FAQ" });
  }
});

app.use("/api", apiRouter);

// --- Telegram Bot Logic ---
const token = process.env.TELEGRAM_BOT_TOKEN;
const managerChatId = process.env.MANAGER_CHAT_ID;
const appUrl = process.env.APP_URL;

console.log("Initializing Telegram Bot...");
if (!token) {
  console.error("CRITICAL: TELEGRAM_BOT_TOKEN is missing from environment variables!");
} else {
  console.log("TELEGRAM_BOT_TOKEN is present (length: " + token.length + ")");
}

const bot = token ? new Telegraf(token) : null;

if (bot) {
  // Debug middleware
  bot.use((ctx, next) => {
    console.log(`Incoming update: ${ctx.updateType}`, JSON.stringify(ctx.update, null, 2));
    return next();
  });

  // Bootstrap manager as admin
  if (managerChatId) {
    db.prepare('INSERT OR IGNORE INTO admins (telegram_id, username) VALUES (?, ?)').run(managerChatId, 'Primary Admin');
  }

  // Seed FAQ if empty
  const faqCount = (db.prepare('SELECT COUNT(*) as count FROM faq').get() as any).count;
  if (faqCount === 0) {
    const initialFaqs = [
      { slug: 'faq_textures', question: '🎨 Как загрузить текстуры?', answer: "<b>🎨 ЗАГРУЗКА ТЕКСТУР</b>\n\nВы можете загрузить свои текстуры (плитка, дерево, ткань) в формате JPG/PNG через админ-панель. Система автоматически создаст 3D-материал с нужным блеском и рельефом." },
      { slug: 'faq_devices', question: '💻 Сколько устройств?', answer: "<b>💻 УСТРОЙСТВА</b>\n\n• Тариф START: 1 устройство (+900₽/мес за доп.)\n• Тариф BUSINESS: 5 устройств (+600₽/мес за доп.)\n• Тариф ENTERPRISE: от 25 устройств.\n\nПодробнее: https://visualica.ru/pricing" },
      { slug: 'faq_mobile', question: '📱 Работа на мобильных', answer: "<b>📱 МОБИЛЬНАЯ ВЕРСИЯ</b>\n\nДа, конфигуратор полностью адаптирован под смартфоны и планшеты. Клиенты могут пользоваться им прямо в браузере без установки приложений." },
      { slug: 'faq_photo', question: '📸 Примерка по фото', answer: "<b>📸 ПРИМЕРКА ПО ФОТО</b>\n\nКлиент делает фото своей комнаты → выбирает ваш материал → алгоритм Visualica накладывает текстуру с учетом перспективы и теней." },
      { slug: 'faq_web', question: '🌐 Интеграция на сайт', answer: "<b>🌐 ИНТЕГРАЦИЯ</b>\n\nВы можете встроить конфигуратор на свой сайт через iframe или давать прямую ссылку. Интеграция занимает 5 минут." },
      { slug: 'faq_result', question: '🔗 Результат (скрин/ссылка)', answer: "<b>🔗 РЕЗУЛЬТАТ</b>\n\nКлиент может сохранить скриншот своего дизайна или получить уникальную ссылку на проект, чтобы отправить её вам или поделиться в соцсетях." },
      { slug: 'faq_trial', question: '🧪 Пробный период', answer: "<b>🧪 ТЕСТОВЫЙ ПЕРИОД</b>\n\nМы создаем для вас персональное демо с вашими материалами бесплатно. Это лучше любого пробного периода!" },
      { slug: 'faq_vs', question: '🚀 Отличие от TilesView', answer: "<b>🚀 ПРЕИМУЩЕСТВА</b>\n\n• Более реалистичная 3D-графика\n• Работа с группами товаров (комплекты)\n• Цена в среднем в 2.5 раза ниже\n• Русскоязычная поддержка" },
    ];
    const insertFaq = db.prepare('INSERT INTO faq (slug, question, answer) VALUES (?, ?, ?)');
    initialFaqs.forEach(f => insertFaq.run(f.slug, f.question, f.answer));
  }

  const isAdmin = (chatId: number) => {
    const admin = db.prepare('SELECT * FROM admins WHERE telegram_id = ?').get(chatId.toString());
    return !!admin;
  };

  // Helper to update user state
  const setState = (chatId: number, state: string, data: any = {}) => {
    const stmt = db.prepare('INSERT OR REPLACE INTO user_states (telegram_id, state, data) VALUES (?, ?, ?)');
    stmt.run(chatId.toString(), state, JSON.stringify(data));
  };

  const getState = (chatId: number) => {
    const stmt = db.prepare('SELECT * FROM user_states WHERE telegram_id = ?');
    const row = stmt.get(chatId.toString()) as any;
    return row ? { state: row.state, data: JSON.parse(row.data) } : { state: 'START', data: {} };
  };

  // Main Menu
  const mainMenu = Markup.keyboard([
    ['🚀 Записаться на DEMO', '📚 База знаний (FAQ)'],
    ['📂 Получить материалы', '🤝 Связь с командой']
  ]).resize();

  bot.start(async (ctx) => {
    console.log(`Bot started by user: ${ctx.from.id}`);
    setState(ctx.chat.id, 'START');
    
    const welcomePhoto = 'https://picsum.photos/seed/visualica_pro/1200/600';
    const welcomeText = `<b>🟧 VISUALICA — Будущее презентации вашего продукта</b>\n\nДобро пожаловать! Мы помогаем бизнесу увеличить продажи с помощью фотореалистичных 3D-конфигураторов и AR-технологий.\n\n<b>С моей помощью вы можете:</b>\n🚀 <b>Назначить DEMO</b> — увидите конфигуратор в действии на вашем продукте.\n📚 <b>Изучить FAQ</b> — ответы на все технические и коммерческие вопросы.\n📂 <b>Получить материалы</b> — презентации, прайсы и кейсы внедрения.\n\nВыберите интересующий вас раздел в меню ниже: 👇`;

    try {
      await ctx.replyWithPhoto(welcomePhoto, {
        caption: welcomeText,
        parse_mode: 'HTML',
        ...Markup.inlineKeyboard([
          [Markup.button.callback('🚀 Начать запись на DEMO', 'start_demo')],
          [Markup.button.url('📺 Смотреть видео-обзор', 'https://visualica.ru')],
          [Markup.button.url('🔗 Поделиться ботом', `https://t.me/share/url?url=https://t.me/${ctx.botInfo.username}&text=Посмотри%20крутой%203D-конфигуратор%20Visualica!`)]
        ])
      });
      await ctx.reply("Воспользуйтесь меню для навигации:", mainMenu);
    } catch (err) {
      console.error("Failed to send welcome photo:", err);
      ctx.reply(welcomeText, { parse_mode: 'HTML', ...mainMenu });
    }
  });

  bot.command('ping', (ctx) => {
    console.log(`Ping received from: ${ctx.from.id}`);
    ctx.reply('<b>🟧 VISUALICA SYSTEM</b>: Online', { parse_mode: 'HTML' });
  });

  bot.command('admin', (ctx) => {
    console.log(`Admin command from: ${ctx.from.id}`);
    if (!isAdmin(ctx.chat.id)) {
      console.log(`Access denied for user: ${ctx.from.id}`);
      return ctx.reply("<b>❌ Доступ ограничен</b>\nТолько для авторизованных операторов.", { parse_mode: 'HTML' });
    }
    ctx.reply("<b>🟧 ADMIN CONSOLE</b>\nУправление лидами, статистикой и командой:", {
      parse_mode: 'HTML',
      ...Markup.inlineKeyboard([
        [Markup.button.webApp('ОТКРЫТЬ ПАНЕЛЬ УПРАВЛЕНИЯ', appUrl || '')]
      ])
    });
  });

  // FAQ Branch
  bot.hears('📚 База знаний (FAQ)', (ctx) => {
    try {
      const faqs = db.prepare('SELECT * FROM faq').all() as any[];
      const buttons = faqs.map(f => [Markup.button.callback(f.question, f.slug)]);
      
      ctx.reply("<b>🟧 БАЗА ЗНАНИЙ</b>\nВыберите тему, которая вас интересует:", {
        parse_mode: 'HTML',
        ...Markup.inlineKeyboard(buttons)
      });
    } catch (err) {
      console.error("Failed to fetch FAQ for bot:", err);
      ctx.reply("Извините, база знаний временно недоступна.");
    }
  });

  bot.on('callback_query', async (ctx) => {
    const data = (ctx.callbackQuery as any).data;
    
    // Check if it's an FAQ slug
    const faq = db.prepare('SELECT * FROM faq WHERE slug = ?').get(data) as any;
    
    if (faq) {
      await ctx.reply(faq.answer, { parse_mode: 'HTML' });
      await ctx.reply("Что дальше?", Markup.inlineKeyboard([
        [Markup.button.callback('⬅️ Вернуться к вопросам', 'back_to_faq')],
        [Markup.button.callback('🚀 Записаться на демо', 'start_demo')],
        [Markup.button.callback('📂 Получить материалы', 'get_materials')],
      ]));
    } else if (data === 'back_to_faq') {
      try {
        const faqs = db.prepare('SELECT * FROM faq').all() as any[];
        const buttons = faqs.map(f => [Markup.button.callback(f.question, f.slug)]);
        ctx.reply("<b>🟧 БАЗА ЗНАНИЙ</b>\nВыберите тему:", {
          parse_mode: 'HTML',
          ...Markup.inlineKeyboard(buttons)
        });
      } catch (err) {
        ctx.reply("Ошибка при загрузке вопросов.");
      }
    } else if (data === 'start_demo') {
      startDemoFlow(ctx);
    } else if (data === 'get_materials') {
      startMaterialsFlow(ctx);
    } else if (data.startsWith('status_')) {
      const [_, status, leadId] = data.split('_');
      if (isAdmin(ctx.chat.id)) {
        try {
          db.prepare('UPDATE leads SET status = ? WHERE id = ?').run(status, leadId);
          ctx.answerCbQuery(`Статус обновлен на: ${status}`);
          const msg = ctx.callbackQuery.message as any;
          const currentText = msg?.text || msg?.caption || '';
          ctx.editMessageText(currentText + `\n\n✅ Статус изменен на: <b>${status.toUpperCase()}</b>`, { parse_mode: 'HTML' });
        } catch (err) {
          console.error("Failed to update status via bot:", err);
          ctx.answerCbQuery("Ошибка при обновлении статуса");
        }
      } else {
        ctx.answerCbQuery("У вас нет прав администратора");
      }
    }
    ctx.answerCbQuery();
  });

  // Demo Flow
  const startDemoFlow = (ctx: any) => {
    setState(ctx.chat.id, 'DEMO_NAME');
    ctx.reply("<b>🟧 ЗАПИСЬ НА DEMO</b>\n\nОтлично! Давайте назначим встречу. \n\nДля начала, как вас зовут и какую компанию вы представляете?", { parse_mode: 'HTML' });
  };

  bot.hears('🚀 Записаться на DEMO', (ctx) => startDemoFlow(ctx));

  // Materials Flow
  const startMaterialsFlow = (ctx: any) => {
    setState(ctx.chat.id, 'MATERIALS_ROLE');
    ctx.reply("<b>🟧 ПОЛУЧЕНИЕ МАТЕРИАЛОВ</b>\n\nЧтобы я прислал наиболее подходящие файлы, уточните вашу роль:", {
      parse_mode: 'HTML',
      ...Markup.keyboard([
        ['🏭 Производитель', '🏪 Дилер / Магазин'],
        ['🏗️ Застройщик', '👤 Другое']
      ]).oneTime().resize()
    });
  };

  bot.hears('📂 Получить материалы', (ctx) => startMaterialsFlow(ctx));

  // Handoff
  bot.hears('🤝 Связь с командой', (ctx) => {
    ctx.reply("<b>🟧 СВЯЗЬ С КОМАНДОЙ</b>\n\nЯ передал ваш запрос специалисту. Мы ответим вам в этом чате в течение часа (в рабочее время).\n\nПока вы можете изучить нашу базу знаний или получить материалы.", { parse_mode: 'HTML' });
    const admins = db.prepare('SELECT telegram_id FROM admins').all() as any[];
    const notification = `🔔 <b>TEAM REQUEST</b>\n\nПользователь @${ctx.from.username || ctx.from.id} просит связаться с командой.`;
    
    for (const admin of admins) {
      try {
        bot.telegram.sendMessage(admin.telegram_id, notification, { parse_mode: 'HTML' });
      } catch (err) {
        console.error(`Failed to notify admin ${admin.telegram_id}:`, err);
      }
    }
  });

  // Text Handling for Flows
  bot.on('text', async (ctx) => {
    const { state, data } = getState(ctx.chat.id);

    if (state === 'DEMO_NAME') {
      setState(ctx.chat.id, 'DEMO_ROLE', { ...data, name: ctx.message.text });
      ctx.reply("<b>🟧 КВАЛИФИКАЦИЯ</b>\n\nУточните вашу роль в бизнесе:", {
        parse_mode: 'HTML',
        ...Markup.keyboard([
          ['🏭 Производитель', '🏪 Дилер / Магазин'],
          ['🏗️ Застройщик', '👤 Другое']
        ]).oneTime().resize()
      });
    } else if (state === 'DEMO_ROLE') {
      setState(ctx.chat.id, 'DEMO_SKU', { ...data, role: ctx.message.text });
      ctx.reply("<b>🟧 МАСШТАБ КАТАЛОГА</b>\n\nСколько примерно SKU (позиций) у вас в каталоге?", {
        parse_mode: 'HTML',
        ...Markup.keyboard([
          ['до 50', '50–300'],
          ['300–1500', 'более 1500']
        ]).oneTime().resize()
      });
    } else if (state === 'DEMO_SKU') {
      setState(ctx.chat.id, 'DEMO_TIME', { ...data, sku: ctx.message.text });
      ctx.reply("<b>🟧 ВРЕМЯ ВСТРЕЧИ</b>\n\nКогда вам было бы удобно провести звонок (около 30 минут)?", {
        parse_mode: 'HTML',
        ...Markup.keyboard([
          ['Сегодня после 15:00', 'Завтра 10:00–13:00'],
          ['Завтра после 15:00', '📅 Другое время']
        ]).oneTime().resize()
      });
    } else if (state === 'DEMO_TIME') {
      const timeInput = ctx.message.text;
      
      if (timeInput === '📅 Другое время') {
        ctx.reply("<b>🟧 СВОЙ ВАРИАНТ</b>\n\nПожалуйста, напишите удобную дату и время текстом (например: 'Среда, 12:00'):", { parse_mode: 'HTML' });
        return; // Stay in DEMO_TIME state
      }

      const finalData = { ...data, time: timeInput };
      setState(ctx.chat.id, 'START');
      
      try {
        // Save to DB
        const stmt = db.prepare(`
          INSERT INTO leads (telegram_id, name, company, role, sku_count, preferred_time, source)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `);
        const result = stmt.run(ctx.chat.id.toString(), finalData.name, 'N/A', finalData.role, finalData.sku, finalData.time, 'Telegram Bot');
        const leadId = result.lastInsertRowid;

        const successMsg = `<b>✅ ЗАЯВКА ПРИНЯТА!</b>\n\n${finalData.name}, спасибо! Наш специалист свяжется с вами в указанное время.\n\nПока мы готовимся к встрече, рекомендую ознакомиться с нашими материалами. 👇`;
        ctx.reply(successMsg, { parse_mode: 'HTML', ...mainMenu });
        
        // Notify All Admins
        const admins = db.prepare('SELECT telegram_id FROM admins').all() as any[];
        const notification = `🔥 <b>НОВАЯ ЗАЯВКА НА DEMO</b>\n\n👤 <b>Имя:</b> ${finalData.name}\n🏢 <b>Роль:</b> ${finalData.role}\n📦 <b>SKU:</b> ${finalData.sku}\n🕐 <b>Время:</b> ${finalData.time}\n\n🔗 <b>Пользователь:</b> @${ctx.from.username || ctx.from.id}`;
        
        for (const admin of admins) {
          try {
            bot.telegram.sendMessage(admin.telegram_id, notification, {
              parse_mode: 'HTML',
              ...Markup.inlineKeyboard([
                [Markup.button.callback('📞 В работе', `status_contacted_${leadId}`), Markup.button.callback('✅ Готово', `status_done_${leadId}`)],
                [Markup.button.webApp('Открыть админку', appUrl || '')]
              ])
            });
          } catch (err) {
            console.error(`Failed to notify admin ${admin.telegram_id}:`, err);
          }
        }
      } catch (dbErr) {
        console.error("Database error during lead save:", dbErr);
        ctx.reply("Произошла ошибка при сохранении заявки. Пожалуйста, попробуйте позже или свяжитесь с командой напрямую.", mainMenu);
      }
    } else if (state === 'MATERIALS_ROLE') {
      const role = ctx.message.text;
      setState(ctx.chat.id, 'START');
      if (role.includes('Производитель')) {
        ctx.reply("📎 <b>ВАШИ МАТЕРИАЛЫ</b>\n\nМы подготовили набор для производителей:\n• Технический гайд\n• Общая презентация\n• Тарифная сетка", { parse_mode: 'HTML', ...mainMenu });
      } else if (role.includes('Дилер')) {
        ctx.reply("📎 <b>ВАШИ МАТЕРИАЛЫ</b>\n\nНабор для дилеров и магазинов:\n• Презентация продукта\n• Кейс-сравнение эффективности\n• Гайд по интеграции", { parse_mode: 'HTML', ...mainMenu });
      } else {
        ctx.reply("📎 <b>ВАШИ МАТЕРИАЛЫ</b>\n\nОбщий ознакомительный набор:\n• Презентация Visualica\n• Кейсы застройщиков\n• Контакты команды", { parse_mode: 'HTML', ...mainMenu });
      }
    } else if (!ctx.message.text.startsWith('/')) {
        console.log(`Unknown message from ${ctx.from.id}: ${ctx.message.text}`);
        ctx.reply("Я получил ваше сообщение, но пока умею отвечать только на кнопки меню. Пожалуйста, выберите один из вариантов ниже: 👇", mainMenu);
    }
  });

  bot.launch().then(() => {
    console.log("✅ Telegram Bot started successfully.");
  }).catch((err) => {
    console.error("❌ Failed to launch Telegram Bot:", err);
    console.error("Check your TELEGRAM_BOT_TOKEN and network connection.");
  });

  // Enable graceful stop
  process.once('SIGINT', () => bot.stop('SIGINT'));
  process.once('SIGTERM', () => bot.stop('SIGTERM'));
}

// Vite middleware for development
async function setupVite(app: express.Application) {
  if (process.env.NODE_ENV !== "production") {
    try {
      console.log("Initializing Vite server...");
      const vite = await createViteServer({
        server: { middlewareMode: true },
        appType: "spa",
      });
      app.use(vite.middlewares);
      console.log("Vite middleware loaded successfully");
    } catch (err) {
      console.error("Failed to initialize Vite server:", err);
    }
  }
}

const server = app.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 Visualica Server is now listening on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`App URL: ${appUrl || 'Not set'}`);
});

console.log("Starting Vite setup...");
setupVite(app);
