
(function(plugin) {
    plugin.create = function() {
        const API_SITES = [
            { name: "Site1", url: "https://api.site1.com/videos" },
            { name: "Site2", url: "https://api.site2.com/videos" },
            { name: "Site3", url: "https://api.site3.com/videos" }
        ];

        const API_KEY = "YOUR_API_KEY";

        // Качества, которые нужно исключить
        const EXCLUDED_QUALITIES = ["4K", "2160p"]; // Например, требующие регистрации

        // Фильтрация по качеству
        function filterByQuality(video) {
            return video.stream_links.some(link => 
                !EXCLUDED_QUALITIES.includes(link.quality)
            );
        }

        // Получение данных с одного сайта
        async function fetchVideosFromSite(apiUrl) {
            try {
                let response = await fetch(apiUrl, {
                    method: "GET",
                    headers: {
                        "Authorization": `Bearer ${API_KEY}`,
                        "Content-Type": "application/json"
                    }
                });

                if (!response.ok) {
                    throw new Error(`Ошибка API: ${response.status}`);
                }

                let videos = await response.json();

                // Применяем фильтр по качеству
                return videos.filter(filterByQuality);
            } catch (error) {
                console.error(`Ошибка при загрузке данных с ${apiUrl}:`, error);
                return [];
            }
        }

        // Объединение данных из всех источников
        async function fetchAllVideos() {
            let allVideos = [];
            let promises = API_SITES.map(async (site) => {
                let videos = await fetchVideosFromSite(site.url);
                return videos.map((video) => ({
                    ...video,
                    source: site.name // Добавляем источник
                }));
            });

            let results = await Promise.all(promises);
            results.forEach((videos) => allVideos.push(...videos));
            return allVideos;
        }

        // Группировка фильмов по названию
        function groupVideosByTitle(videos) {
            let grouped = {};
            videos.forEach((video) => {
                if (!grouped[video.title]) {
                    grouped[video.title] = [];
                }
                grouped[video.title].push(video);
            });
            return grouped;
        }

        // Показ выбора качества для конкретного фильма
        function selectQuality(videoGroup) {
            let items = videoGroup
                .flatMap(video => 
                    video.stream_links
                        .filter(link => !EXCLUDED_QUALITIES.includes(link.quality)) // Исключаем качества
                        .map(link => ({
                            title: `${video.source} - ${link.quality}`,
                            url: link.url,
                            poster: video.thumbnail
                        }))
                );

            if (items.length === 0) {
                Lampa.Noty.show("Нет доступных видео для воспроизведения");
                return;
            }

            Lampa.Select.show({
                title: "Выберите источник и качество",
                items: items,
                onSelect: (selected) => {
                    // Воспроизводим выбранное видео
                    Lampa.Player.play({
                        title: videoGroup[0].title,
                        url: selected.url,
                        poster: selected.poster
                    });
                },
                onBack: () => {
                    Lampa.Controller.toggle("content"); // Возврат в интерфейс
                }
            });
        }

        // Отображение фильмов
        function displayVideos(groupedVideos) {
            Object.keys(groupedVideos).forEach((title) => {
                Lampa.Activity.push({
                    title: title,
                    description: "Доступно с нескольких источников",
                    poster: groupedVideos[title][0]?.thumbnail || "",
                    onPlay: () => selectQuality(groupedVideos[title])
                });
            });
        }

        // Инициализация плагина
        Lampa.Listener.follow('start', function(event) {
            if (event.name === 'start') {
                console.log("Плагин MyVideoPlugin запущен");

                Lampa.Noty.show("Загрузка фильмов...");
                fetchAllVideos().then((videos) => {
                    if (videos.length) {
                        let groupedVideos = groupVideosByTitle(videos);
                        displayVideos(groupedVideos);
                        Lampa.Noty.show("Фильмы успешно загружены");
                    } else {
                        Lampa.Noty.show("Фильмы не найдены");
                    }
                });
            }
        });

        console.log("Плагин MyVideoPlugin успешно активирован");
    };

    // Добавляем плагин в Lampa
    plugin.add();
})(this);
