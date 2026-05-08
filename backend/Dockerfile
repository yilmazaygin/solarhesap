FROM python:3.12-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app/ ./app/

RUN mkdir -p logs

EXPOSE 8000

CMD ["uvicorn", "app.create_app:app", "--host", "0.0.0.0", "--port", "8000"]
