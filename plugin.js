import requests
from bs4 import BeautifulSoup
from lampa import Plugin, Router, Player

class RezkaPlugin(Plugin):
    def __init__(self):
        self.base_url = "https://rezka-ua.tv"

    # Метод для получения данных о фильме, включая доступные качества и озвучки
    def fetch_movie_data(self, movie_id):
        url = f"{self.base_url}/films/{movie_id}/"
        response = requests.get(url)
        soup = BeautifulSoup(response.text, 'html.parser')

        # Извлечение доступных качеств видео
        qualities = []
        quality_elements = soup.find_all("option", {"value": True})
        for option in quality_elements:
            qualities.append(option.text.strip())
        
        # Извлечение доступных озвучек
        audio_tracks = []
        audio_elements = soup.find_all("a", class_="audio-track")  # Примерный класс для озвучки
        for audio in audio_elements:
            audio_tracks.append(audio.text.strip())
        
        return qualities, audio_tracks

    # Метод для воспроизведения фильма с выбранным качеством и озвучкой
    def play_movie(self, movie_id, quality, audio_track):
        url = f"{self.base_url}/films/{movie_id}/#{quality}"
        response = requests.get(url)
        soup = BeautifulSoup(response.text, 'html.parser')

        # Находим ссылку для видео
        video_url = soup.find("video").get("src")
        
        # Находим ссылку для аудиотрека
        audio_url = self.find_audio_track_url(movie_id, audio_track)
        
        return video_url, audio_url

    # Метод для получения URL озвучки
    def find_audio_track_url(self, movie_id, audio_track):
        url = f"{self.base_url}/films/{movie_id}/audio/{audio_track}/"
        response = requests.get(url)
        soup = BeautifulSoup(response.text, 'html.parser')
        audio_url = soup.find("audio").get("src")
        return audio_url

    # Метод для отображения фильтра качества и озвучки
    def display_quality_filter(self, movie_id):
        qualities, audio_tracks = self.fetch_movie_data(movie_id)

        # Создание интерфейса для выбора качества и озвучки
        filter_ui = self.create_quality_filter_ui(movie_id, qualities, audio_tracks)
        self.show_ui(filter_ui)

    # Метод для создания кнопок выбора качества и озвучки
    def create_quality_filter_ui(self, movie_id, qualities, audio_tracks):
        quality_buttons = []
        # Создаем кнопки для выбора качества видео
        for quality in qualities:
            quality_buttons.append(self.create_button(f"Качество: {quality}", callback=lambda q=quality: self.display_audio_filter(movie_id, q, audio_tracks)))
        
        return quality_buttons

    # Метод для отображения фильтра озвучек
    def display_audio_filter(self, movie_id, quality, audio_tracks):
        audio_buttons = []
        # Создаем кнопки для выбора озвучки
        for track in audio_tracks:
            audio_buttons.append(self.create_button(f"Озвучка: {track}", callback=lambda t=track: self.play_movie(movie_id, quality, t)))
        
        self.show_ui(audio_buttons)

    # Метод для отображения плагина в интерфейсе Lampa
    def on_start(self):
        router = Router(self)
        router.add_route('/films/{movie_id}', self.display_quality_filter)

        # Когда плагин стартует, можно выбрать фильм по ID (например, примерный фильм)
        self.display_quality_filter('example_movie_id')

    # Указываем название плагина для отображения в интерфейсе Lampa
    def plugin_name(self):
        return "Rezka"  # Имя плагина для интерфейса
