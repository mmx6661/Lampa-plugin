from lampa import Plugin, log

class RezkaPlugin(Plugin):
    def __init__(self):
        # Простой пример плагина
        self.plugin_name = "Rezka"  # Название плагина для отображения в интерфейсе Lampa

    def on_start(self):
        # Простейшая инициализация
        log.info(f"Плагин {self.plugin_name} активирован")

        # Пример простого UI с кнопками
        self.show_ui([
            self.create_button("Выбрать качество", callback=self.select_quality),
            self.create_button("Выбрать озвучку", callback=self.select_audio)
        ])

    def select_quality(self):
        log.info("Выбрано качество")  # Логируем действие
        # Логика выбора качества будет здесь

    def select_audio(self):
        log.info("Выбрана озвучка")  # Логируем действие
        # Логика выбора озвучки будет здесь

# Инициализация плагина
plugin = RezkaPlugin()
plugin.on_start()
