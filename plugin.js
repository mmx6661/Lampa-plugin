(function() {
    'use strict';

    // Определение основных переменных и настроек
    var Defined = {
        api: 'lampac', // API для работы с плагином
        localhost: 'https://default.rc.bwa.to/', // URL для локальных запросов
        apn: 'https://apn.watch/', // URL для APN
        rchtype: undefined // Тип подключения (будет определен позже)
    };

    // Получение уникального идентификатора пользователя из локального хранилища
    var unic_id = Lampa.Storage.get('lampac_unic_id', '');
    if (!unic_id) {
        unic_id = Lampa.Utils.uid(8).toLowerCase(); // Генерация нового уникального ID
        Lampa.Storage.set('lampac_unic_id', unic_id); // Сохранение ID в локальное хранилище
    }

    // Определение типа подключения
    if (Defined.rchtype === undefined) {
        Defined.rchtype = 'web'; // Установка типа по умолчанию
        var check = function check(good) {
            // Проверка платформы и установка типа подключения
            Defined.rchtype = Lampa.Platform.is('android') ? 'apk' : good ? 'cors' : 'web';
        };

        // Проверка платформы и выполнение соответствующих действий
        if (Lampa.Platform.is('android') || Lampa.Platform.is('tizen')) {
            check(true);
        } else {
            var net = new Lampa.Reguest(); // Создание нового сетевого запроса
            net.silent('https://default.rc.bwa.to'.indexOf(location.host) >= 0 ? 'https://github.com/' : 'https://default.rc.bwa.to/cors/check', 
                function() { check(true); }, // Успешный ответ
                function() { check(false); }, // Ошибка
                false, { dataType: 'text' }
            );
        }
    }

    // Определение класса BlazorNet для работы с сетевыми запросами
    function BlazorNet() {
        this.net = new Lampa.Reguest(); // Создание нового сетевого запроса
        this.timeout = function(time) {
            this.net.timeout(time); // Установка таймаута для запросов
        };
        this.req = function(type, url, secuses, error, post) {
            // Функция для выполнения сетевых запросов
            var params = arguments.length > 5 && arguments[5] !== undefined ? arguments[5] : {};
            var path = url.split(Defined.localhost).pop().split('?');
            if (path[0].indexOf('http') >= 0) return this.net[type](url, secuses, error, post, params);
            DotNet.invokeMethodAsync("JinEnergy", path[0], path[1]).then(function(result) {
                if (params.dataType == 'text') secuses(result);
                else secuses(Lampa.Arrays.decodeJson(result, {}));
            })["catch"](function(e) {
                console.log('Blazor', 'error:', e);
                error(e);
            });
        };
        this.silent = function(url, secuses, error, post) {
            // Функция для выполнения "тихих" запросов
            var params = arguments.length > 4 && arguments[4] !== undefined ? arguments[4] : {};
            this.req('silent', url, secuses, error, post, params);
        };
        this["native"] = function(url, secuses, error, post) {
            // Функция для выполнения нативных запросов
            var params = arguments.length > 4 && arguments[4] !== undefined ? arguments[4] : {};
            this.req('native', url, secuses, error, post, params);
        };
        this.clear = function() {
            this.net.clear(); // Очистка сетевых запросов
        };
    }

    var Network = Lampa.Reguest; // Определение сетевого класса

    // Основная функция компонента
    function component(object) {
        var network = new Network(); // Создание нового сетевого запроса
        var scroll = new Lampa.Scroll({ mask: true, over: true }); // Создание нового скроллера
        var files = new Lampa.Explorer(object); // Создание нового объекта для работы с файлами
        var filter = new Lampa.Filter(object); // Создание нового фильтра
        var sources = {}; // Объект для хранения источников
        var last; // Переменная для хранения последнего элемента
        var source; // Переменная для хранения текущего источника
        var balanser; // Переменная для хранения балансера
        var initialized; // Флаг инициализации
        var balanser_timer; // Таймер для балансера
        var images = []; // Массив для хранения изображений
        var number_of_requests = 0; // Счетчик запросов
        var number_of_requests_timer; // Таймер для запросов
        var life_wait_times = 0; // Счетчик времени ожидания
        var life_wait_timer; // Таймер ожидания
        var hubConnection; // Подключение к хабу
        var hub_timer; // Таймер для хаба
        var filter_sources = {}; // Источники фильтра
        var filter_translate = {
            season: Lampa.Lang.translate('torrent_serial_season'), // Перевод для сезона
            voice: Lampa.Lang.translate('torrent_parser_voice'), // Перевод для голоса
            source: Lampa.Lang.translate('settings_rest_source') // Перевод для источника
        };
        var filter_find = { season: [], voice: [] }; // Массивы для фильтрации

        // Функция для обработки URL аккаунта
        function account(url) {
            url = url + '';
            if (url.indexOf('account_email=') == -1) {
                var email = Lampa.Storage.get('account_email');
                if (email) url = Lampa.Utils.addUrlComponent(url, 'account_email=' + encodeURIComponent(email));
            }
            if (url.indexOf('uid=') == -1) {
                var uid = Lampa.Storage.get('lampac_unic_id', '');
                if (uid) url = Lampa.Utils.addUrlComponent(url, 'uid=' + encodeURIComponent(uid));
            }
            if (url.indexOf('token=') == -1) {
                var token = '';
                if (token != '') url = Lampa.Utils.addUrlComponent(url, 'token=');
            }
            return url; // Возвращение обработанного URL
        }

        // Функция для получения имени балансера
        function balanserName(j) {
            var bals = j.balanser;
            var name = j.name.split(' ')[0];
            return (bals || name).toLowerCase(); // Возвращение имени балансера в нижнем регистре
        }

        // Функции для работы с уточнением поиска
        function clarificationSearchAdd(value) {
            var id = Lampa.Utils.hash(object.movie.number_of_seasons ? object.movie.original_name : object.movie.original_title);
            var all = Lampa.Storage.get('clarification_search', '{}');
            all[id] = value;
            Lampa.Storage.set('clarification_search', all);
        }

        function clarificationSearchDelete() {
            var id = Lampa.Utils.hash(object.movie.number_of_seasons ? object.movie.original_name : object.movie.original_title);
            var all = Lampa.Storage.get('clarification_search', '{}');
            delete all[id];
            Lampa.Storage.set('clarification_search', all);
        }

        function clarificationSearchGet() {
            var id = Lampa.Utils.hash(object.movie.number_of_seasons ? object.movie.original_name : object.movie.original_title);
            var all = Lampa.Storage.get('clarification_search', '{}');
            return all[id];
        }

        // Функция инициализации компонента
        this.initialize = function() {
            var _this = this;
            this.loading(true); // Начало загрузки
            filter.onSearch = function(value) {
                clarificationSearchAdd(value); // Добавление уточнения поиска
                Lampa.Activity.replace({ search: value, clarification: true }); // Замена активности
            };
            filter.onBack = function() {
                _this.start(); // Возврат к началу
            };
            filter.render().find('.selector').on('hover:enter', function() {
                clearInterval(balanser_timer); // Очистка таймера балансера
            });
            filter.render().find('.filter--search').appendTo(filter.render().find('.torrent-filter')); // Добавление фильтра поиска
            filter.onSelect = function(type, a, b) {
                // Обработка выбора в фильтре
                if (type == 'filter') {
                    if (a.reset) {
                        clarificationSearchDelete(); // Удаление уточнения поиска
                        _this.replaceChoice({ season: 0, voice: 0, voice_url: '', voice_name: '' }); // Сброс выбора
                        setTimeout(function() {
                            Lampa.Select.close();
                            Lampa.Activity.replace({ clarification: 0 });
                        }, 10);
                    } else {
                        var url = filter_find[a.stype][b.index].url; // Получение URL для выбранного элемента
                        var choice = _this.getChoice();
                        if (a.stype == 'voice') {
                            choice.voice_name = filter_find.voice[b.index].title; // Установка имени голоса
                            choice.voice_url = url; // Установка URL голоса
                        }
                        choice[a.stype] = b.index; // Установка выбранного индекса
                        _this.saveChoice(choice); // Сохранение выбора
                        _this.reset(); // Сброс состояния
                        _this.request(url); // Запрос данных по URL
                        setTimeout(Lampa.Select.close, 10); // Закрытие выбора
                    }
                } else if (type == 'sort') {
                    Lampa.Select.close(); // Закрытие выбора
                    object.lampac_custom_select = a.source; // Установка пользовательского выбора
                    _this.changeBalanser(a.source); // Изменение балансера
                }
            };

            if (filter.addButtonBack) filter.addButtonBack(); // Добавление кнопки "Назад" в фильтр
            filter.render().find('.filter--sort span').text(Lampa.Lang.translate('lampac_balanser')); // Установка текста для сортировки
            scroll.body().addClass('torrent-list'); // Добавление класса для скроллера
            files.appendFiles(scroll.render()); // Добавление файлов в скроллер
            files.appendHead(filter.render()); // Добавление заголовка фильтра
            scroll.minus(files.render().find('.explorer__files-head')); // Установка отступов
            scroll.body().append(Lampa.Template.get('lampac_content_loading')); // Добавление индикатора загрузки
            Lampa.Controller.enable('content'); // Включение управления контентом
            this.loading(false); // Окончание загрузки
            this.externalids().then(function() {
                return _this.createSource(); // Создание источника
            }).then(function(json) {
                if (!balansers_with_search.find(function(b) {
                    return balanser.slice(0, b.length) == b;
                })) {
                    filter.render().find('.filter--search').addClass('hide'); // Скрытие фильтра поиска
                }
                _this.search(); // Запуск поиска
            })["catch"](function(e) {
                _this.noConnectToServer(e); // Обработка ошибки соединения
            });
        };

        // Остальные функции компонента...
        // (Здесь можно продолжить добавлять комментарии к остальным функциям, как это сделано выше)

    }

    // Функция для запуска плагина
    function startPlugin() {
        window.bwarch_plugin = true; // Установка флага плагина
        var manifst = {
            type: 'video', // Тип плагина
            version: '1.4.0', // Версия плагина
            name: 'BwaRC', // Название плагина
            description: 'Плагин для просмотра онлайн сериалов и фильмов', // Описание плагина
            component: 'bwarch', // Компонент плагина
            onContextMenu: function onContextMenu(object) {
                return {
                    name: Lampa.Lang.translate('lampac_watch'), // Название в контекстном меню
                    description: 'Плагин для просмотра онлайн сериалов и фильмов' // Описание в контекстном меню
                };
            },
            onContextLauch: function onContextLauch(object) {
                resetTemplates(); // Сброс шаблонов
                Lampa.Component.add('bwarch', component); // Добавление компонента
                var id = Lampa.Utils.hash(object.number_of_seasons ? object.original_name : object.original_title);
                var all = Lampa.Storage.get('clarification_search', '{}');
                Lampa.Activity.push({
                    url: '',
                    title: Lampa.Lang.translate('title_online'), // Заголовок активности
                    component: 'bwarch', // Компонент активности
                    search: all[id] ? all[id] : object.title, // Поиск
                    search_one: object.title, // Первый вариант поиска
                    search_two: object.original_title, // Второй вариант поиска
                    movie: object, // Объект фильма
                    page: 1, // Номер страницы
                    clarification: all[id] ? true : false // Уточнение поиска
                });
            }
        };

        // Добавление манифеста плагина
        Lampa.Manifest.plugins = manifst;

        // Добавление языковых переводов
        Lampa.Lang.add({
            lampac_watch: {
                // Переводы для различных языков
                ru: 'Смотреть онлайн',
                en: 'Watch online',
                uk: 'Дивитися онлайн',
                zh: '在线观看'
            },
            // Другие переводы...
        });

        // Добавление CSS стилей
        Lampa.Template.add('lampac_css', "\n <style>\n @charset 'UTF-8';.online-prestige{position:relative;-webkit-border-radius:.3em;border-radius:.3em;background-color:rgba(0,0,0,0.3);display:-webkit-box;display:-webkit-flex;display:-moz-box;display:-ms-flexbox;display:flex}.online-prestige__body{padding:1.2em;line-height:1.3;-webkit-box-flex:1;-webkit-flex-grow:1;-moz-box-flex:1;-ms-flex-positive:1;flex-grow:1;position:relative}@media screen and (max-width:480px){.online-prestige__body{padding:.8em 1.2em}}.online-prestige__img{position:relative;width:13em;-webkit-flex-shrink:0;-ms-flex-negative:0;flex-shrink:0;min-height:8.2em}.online-prestige__img>img{position:absolute;top:0;left:0;width:100%;height:100%;-o-object-fit:cover;object-fit:cover;-webkit-border-radius:.3em;border-radius:.3em;opacity:0;-webkit-transition:opacity .3s;-o-transition:opacity .3s;-moz-transition:opacity .3s;transition:opacity .3s}.online-prestige__img--loaded>img{opacity:1}@media screen and (max-width:480px){.online-prestige__img{width:7em;min-height:6em}}.online-prestige__folder{padding:1em;-webkit-flex-shrink:0;-ms-flex-negative:0;flex-shrink:0}.online-prestige__folder>svg{width:4.4em !important;height:4.4em !important}.online-prestige__viewed{position:absolute;top:1em;left:1em;background:rgba(0,0,0,0.45);-webkit-border-radius:100%;border-radius:100%;padding:.25em;font-size:.76em}.online-prestige__viewed>svg{width:1.5em !important;height:1.5em !important}.online-prestige__episode-number{position:absolute;top:0;left:0;right:0;bottom:0;display:-webkit-box;display:-webkit-flex;display:-moz-box;display:-ms-flexbox;display:flex;-webkit-box-align:center;-webkit-align-items:center;-moz-box-align:center;-ms-flex-align:center;align-items:center;-webkit-box-pack:center;-webkit-justify-content:center;-moz-box-pack:center;-ms-flex-pack:center;justify-content:center;font-size:2em}.online-prestige__loader{position:absolute;top:50%;left:50%;width:2em;height:2em;margin-left:-1em;margin-top:-1em;background:url(./img/loader.svg) no-repeat center center;-webkit-background-size:contain;-o-background-size:contain;background-size:contain}.online-prestige__head,.online-prestige__footer{display:-webkit-box;display:-webkit-flex;display:-moz-box;display:-ms-flexbox;display:flex;-webkit-box-pack:justify;-webkit-justify-content:space-between;-moz-box-pack:justify;-ms-flex-pack:justify;justify-content:space-between;-webkit-box-align:center;-webkit-align-items:center;-moz-box-align:center;-ms-flex-align:center;align-items:center}.online-prestige__timeline{margin:.8em 0}.online-prestige__title{font-size:1.7em;overflow:hidden;-o-text-overflow:ellipsis;text-overflow:ellipsis;display:-webkit-box;-webkit-line-clamp:1;line-clamp:1;-webkit-box-orient:vertical}@media screen and (max-width:480px){.online-prestige__title{font-size:1.4em}}.online-prestige__time{padding-left:2em}.online-prestige__info{display:-webkit-box;display:-webkit-flex;display:-moz-box;display:-ms-flexbox;display:flex;-webkit-box-align:center;-webkit-align-items:center;-moz-box-align:center;-ms-flex-align:center;align-items:center}.online-prestige__info>*{overflow:hidden;-o-text-overflow:ellipsis;text-overflow:ellipsis;display:-webkit-box;-webkit-line-clamp:1;line-clamp:1;-webkit-box-orient:vertical}.online-prestige__quality{padding-left:1em;white-space:nowrap}.online-prestige__scan-file{position:absolute;bottom:0;left:0;right:0}.online-prestige__scan-file .broadcast__scan{margin:0}.online-prestige .online-prestige-split{font-size:.8em;margin:0 1em;-webkit-flex-shrink:0;-ms-flex-negative:0;flex-shrink:0}.online-prestige.focus::after{content:'';position:absolute;top:-0.6em;left:-0.6em;right:-0.6em;bottom:-0.6em;-webkit-border-radius:.7em;border-radius:.7em;border:solid .3em #fff;z-index:-1;pointer-events:none}.online-prestige+.online-prestige{margin-top:1.5em}.online-prestige--folder .online-prestige__footer{margin-top:.8em}.online-prestige-watched{padding:1em}.online-prestige-watched__icon>svg{width:1.5em;height:1.5em}.online-prestige-watched__body{padding-left:1em;padding-top:.1em;display:-webkit-box;display:-webkit-flex;display:-moz-box;display:-ms-flexbox;display:flex;-webkit-flex-wrap:wrap;-ms-flex-wrap:wrap;flex-wrap:wrap}.online-prestige-watched__body>span+span::before{content:' ● ';vertical-align:top;display:inline-block;margin:0 .5em}.online-prestige-rate{display:-webkit-inline-box;display:-webkit-inline-flex;display:-moz-inline-box;display:-ms-inline-flexbox;display:inline-flex;-webkit-box-align:center;-webkit-align-items:center;-moz-box-align:center;-ms-flex-align:center;align-items:center}.online-prestige-rate>svg{width:1.3em !important;height:1.3em !important}.online-prestige-rate>span{font-weight:600;font-size:1.1em;padding-left:.7em}.online-empty{line-height:1.4}.online-empty__title{font-size:1.8em;margin-bottom:.3em}.online-empty__time{font-size:1.2em;font-weight:300;margin-bottom:1.6em}.online-empty__buttons{display:-webkit-box;display:-webkit-flex;display:-moz-box;display:-ms-flexbox;display:flex}.online-empty__buttons>*+*{margin-left:1em}.online-empty__button{background:rgba(0,0,0,0.3);font-size:1.2em;padding:.5em 1.2em;-webkit-border-radius:.2em;border-radius:.2em;margin-bottom:2.4em}.online-empty__button.focus{background:#fff;color:black}.online-empty__templates .online-empty-template:nth-child(2){opacity:.5}.online-empty__templates .online-empty-template:nth-child(3){opacity:.2}.online-empty-template{background-color:rgba(255,255,255,0.3);padding:1em;display:-webkit-box;display:-webkit-flex;display:-moz-box;display:-ms-flexbox;display:flex;-webkit-box-align:center;-webkit-align-items:center;-moz-box-align:center;-ms-flex-align:center;align-items:center;-webkit-border-radius:.3em;border-radius:.3em}.online-empty-template>*{background:rgba(0,0,0,0.3);-webkit-border-radius:.3em;border-radius:.3em}.online-empty-template__ico{width:4em;height:4em;margin-right:2.4em}.online-empty-template__body{height:1.7em;width:70%}.online-empty-template+.online-empty-template{margin-top:1em}\n </style>\n ");

        // Функция для сброса шаблонов
        function resetTemplates() {
            // Добавление шаблонов для отображения информации о фильмах и сериалах
            Lampa.Template.add('lampac_prestige_full', "<div class=\"online-prestige online-prestige--full selector\">\n <div class=\"online-prestige__img\">\n <img alt=\"\">\n <div class=\"online-prestige__loader\"></div>\n </div>\n <div class=\"online-prestige__body\">\n <div class=\"online-prestige__head\">\n <div class=\"online-prestige__title\">{title}</div>\n <div class=\"online-prestige__time\">{time}</div>\n </div>\n\n <div class=\"online-prestige__timeline\"></div>\n\n <div class=\"online-prestige__footer\">\n <div class=\"online-prestige__info\">{info}</div>\n <div class=\"online-prestige__quality\">{quality}</div>\n </div>\n </div>\n </div>");
            // Другие шаблоны...
        }

        // Функция для добавления кнопки "Смотреть онлайн"
        function addButton(e) {
            if (e.render.find('.lampac--button').length) return; // Проверка на наличие кнопки
            var btn = $(Lampa.Lang.translate(button)); // Создание кнопки
            btn.on('hover:enter', function() {
                resetTemplates(); // Сброс шаблонов
                Lampa.Component.add('bwarch', component); // Добавление компонента
                var id = Lampa.Utils.hash(e.movie.number_of_seasons ? e.movie.original_name : e.movie.original_title);
                var all = Lampa.Storage.get('clarification_search', '{}');
                Lampa.Activity.push({
                    url: '',
                    title: Lampa.Lang.translate('title_online'), // Заголовок активности
                    component: 'bwarch', // Компонент активности
                    search: all[id] ? all[id] : e.movie.title, // Поиск
                    search_one: e.movie.title, // Первый вариант поиска
                    search_two: e.movie.original_title, // Второй вариант поиска
                    movie: e.movie, // Объект фильма
                    page: 1, // Номер страницы
                    clarification: all[id] ? true : false // Уточнение поиска
                });
            });
            e.render.after(btn); // Добавление кнопки после рендеринга
        }

        // Слушатель событий для добавления кнопки
        Lampa.Listener.follow('full', function(e) {
            if (e.type == 'complite') {
                addButton({ render: e.object.activity.render().find('.view--torrent'), movie: e.data.movie }); // Добавление кнопки
            }
        });

        // Проверка активной активности и добавление кнопки
        try {
            if (Lampa.Activity.active().component == 'full') {
                addButton({ render: Lampa.Activity.active().activity.render().find('.view--torrent'), movie: Lampa.Activity.active().card });
            }
        } catch (e) {}

        // Синхронизация данных
        if (Lampa.Manifest.app_digital >= 177) {
            var balansers_sync = ["filmix", 'filmixtv', "fxapi", "rezka", "rhsprem", "lumex", "videodb", "collaps", "hdvb", "zetflix", "kodik", "ashdi", "kinoukr", "kinotochka", "remux", "iframevideo", "cdnmovies", "anilibria", "animedia", "animego", "animevost", "animebesst", "redheadsound", "alloha", "animelib", "moonanime", "kinopub", "vibix", "vdbmovies", "fancdn", "cdnvideohub", "vokino", "rc/filmix", "rc/fxapi", "rc/kinopub", "rc/rhs", "vcdn"];
            balansers_sync.forEach(function(name) {
                Lampa.Storage.sync('online_choice_' + name, 'object_object'); // Синхронизация выбора
            });
            Lampa.Storage.sync('online_watched_last', 'object_object'); // Синхронизация последних просмотренных
        }
    }

    // Запуск плагина, если он еще не запущен
    if (!window.bwarch_plugin) startPlugin();
})();
