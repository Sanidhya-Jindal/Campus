from django.urls import path, include
from rest_framework_simplejwt.views import TokenRefreshView
from .views import RegisterView, LoginView, UserProfileView

app_name = 'users'

urlpatterns = [
    path("register/", RegisterView.as_view(), name="register"),
    path("login/", LoginView.as_view(), name="login"),
    # path("logout/", LogoutView.as_view(), name="logout"),
    path("me/", UserProfileView.as_view(), name="profile"),
    # Login hands out a refresh token, but there was nowhere to exchange it, so
    # sessions died after ACCESS_TOKEN_LIFETIME (15 min) and every call 401'd.
    path("token/refresh/", TokenRefreshView.as_view(), name="token-refresh"),
]
