from slowapi import Limiter

from app.middleware.client_address import client_address

limiter = Limiter(key_func=client_address)
