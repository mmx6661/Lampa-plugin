import requests
from bs4 import BeautifulSoup
from lampa import Plugin, Router, Player, log

class RezkaPlugin(Plugin):
    def __init__(self):
        self.base_url = "https://rezka-ua.tv"

    def fetch_movie_data(self, movie_id):
        url = f"{self.base_url}/films/{movie_id}/"
        try:
            response = requests.get(url)
            response.raise_for_status()  # Поднимет исключение, если запрос не успешен
            soup = BeautifulSoup(response.text, 'html.parser')

            # Извлечение качеств и озвучек
            qualities = []
            quality_elements = soup.find_all("option", {"value": True})
            for option in quality_elements:
                qualities.append(option.text.strip())

            audio_tracks = []
            audio_elements = soup.find_all("a", class_="audio-track")
            for audio in audio_elements:
                audio_tracks.append(audio.text.strip())

            return qualities, audio_tracks
        except requests.RequestException as e:
            log.error(f"Ошибка при запросе к сайту: {e}")
            return [], []  # Возвращаем пустые списки при ошибке

    def play_movie(self, movie_id, quality, audio_track):
        url = f"{self.base_url}/films/{movie_id}/#{quality}"
        try:
            response = requests.get(url)
            response.raise_for_status()
            soup = BeautifulSoup(response.text, 'html.parser')
            video_url = soup.find("video").get("src")

            audio_url = self.find_audio_track_url(movie_id, audio_track)
            return video_url, audio_url
        except requests.RequestException as e:
            log.error(f"Ошибка при получении видео: {e}")
            return None, None

    def find_audio_track_url(self, movie_id, audio_track):
        url = f"{self.base_url}/films/{movie_id}/audio/{audio_track}/"
        try:
            response = requests.get(url)
            response.raise_for_status()
            soup = BeautifulSoup(response.text, 'html.parser')
            audio_url = soup.find("audio").get("src")
            return audio_url
        except requests.RequestException as e:
            log.error(f"Ошибка при получении озвучки: {e}")
            return None

    def display_quality_filter(self, movie_id):
        qualities, audio_tracks = self.fetch_movie_data(movie_id)

        if not qualities or not audio_tracks:
            log.error("Не удалось получить данные для выбора качества и озвучки.")
            return

        filter_ui = self.create_quality_filter_ui(movie_id, qualities, audio_tracks)
        self.show_ui(filter_ui)

    def create_quality_filter_ui(self, movie_id, qualities, audio_tracks):
        quality_buttons = []
        for quality in qualities:
            quality_buttons.append(self.create_button(f"Качество: {quality}", callback=lambda q=quality: self.display_audio_filter(movie_id, q, audio_tracks)))
        return quality_buttons

    def display_audio_filter(self, movie_id, quality, audio_tracks):
        audio_buttons = []
        for track in audio_tracks:
            audio_buttons.append(self.create_button(f"Озвучка: {track}", callback=lambda t=track: self.play_movie(movie_id, quality, t)))
        self.show_ui(audio_buttons)

    def plugin_name(self):
        return "Rezka"  # Название плагина, которое будет отображаться в интерфейсе Lampa

    def on_start(self):
        router = Router(self)
        router.add_route('/films/{movie_id}', self.display_quality_filter)
        self.display_quality_filter('example_movie_id')
