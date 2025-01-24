from lampa import Plugin, log

class RezkaPlugin(Plugin):
    def __init__(self):
        # Простой пример плагина
        self.plugin_name = "Rezka"  # Название плагина, отображаемое в интерфейсе Lampa

    # Инициализация плагина при запуске
    def on_start(self):
        # Здесь можно показать простое сообщение или интерфейс
        log.info(f"Плагин {self.plugin_name} активирован")

        # Пример простого UI с кнопками
        self.show_ui([
            self.create_button("Выбрать качество", callback=self.select_quality),
            self.create_button("Выбрать озвучку", callback=self.select_audio)
        ])

    # Callback для кнопки "Выбрать качество"
    def select_quality(self):
        log.info("Выбрано качество")
        # Здесь можно добавить логику для выбора качества

    # Callback для кнопки "Выбрать озвучку"
    def select_audio(self):
        log.info("Выбрана озвучка")
        # Здесь можно добавить логику для выбора озвучки

# Инициализация плагина
plugin = RezkaPlugin()
plugin.on_start()
