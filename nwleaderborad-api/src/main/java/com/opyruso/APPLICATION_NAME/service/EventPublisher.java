package com.opyruso.nwleaderboard.service;

import com.opyruso.nwleaderboard.ws.GameEventsSocket;
import com.opyruso.nwleaderboard.ws.GlobalEventsSocket;
import io.quarkus.runtime.StartupEvent;
import jakarta.annotation.PreDestroy;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.event.Observes;
import jakarta.inject.Inject;
import org.apache.kafka.clients.producer.KafkaProducer;
import org.apache.kafka.clients.producer.ProducerConfig;
import org.apache.kafka.clients.producer.ProducerRecord;
import org.apache.kafka.common.serialization.StringSerializer;
import org.eclipse.microprofile.config.inject.ConfigProperty;
import io.vertx.core.json.JsonObject;

import java.util.Properties;

@ApplicationScoped
public class EventPublisher {

    @ConfigProperty(name = "kafka.bootstrap.servers")
    String bootstrap;

    @ConfigProperty(name = "kafka.topicname.root")
    String topicRoot;

    KafkaProducer<String, String> producer;

    @Inject
    GlobalEventsSocket globalSocket;

    @Inject
    GameEventsSocket gameSocket;

    void init(@Observes StartupEvent ev) {
        Properties props = new Properties();
        props.put(ProducerConfig.BOOTSTRAP_SERVERS_CONFIG, bootstrap);
        props.put(ProducerConfig.KEY_SERIALIZER_CLASS_CONFIG, StringSerializer.class.getName());
        props.put(ProducerConfig.VALUE_SERIALIZER_CLASS_CONFIG, StringSerializer.class.getName());
        producer = new KafkaProducer<>(props);
    }

    @PreDestroy
    void close() {
        if (producer != null) {
            producer.close();
        }
    }

    private void send(String topic, JsonObject event) {
        if (producer != null) {
            producer.send(new ProducerRecord<>(topic, event.encode()));
        }
    }

    public void publishGlobal(String type, String playerId, String login, JsonObject data) {
        JsonObject event = new JsonObject()
                .put("event-type", type)
                .put("player-id", playerId)
                .put("login", login)
                .put("data", data);
        String topic = topicRoot + "_GLOBAL_EVENTS";
        send(topic, event);
        globalSocket.broadcast(event.encode());
    }

    public void publishGame(String gameId, String type, String playerId, String login, JsonObject data) {
        JsonObject event = new JsonObject()
                .put("event-type", type)
                .put("player-id", playerId)
                .put("login", login)
                .put("data", data);
        String topic = topicRoot + "_GAME_" + gameId;
        send(topic, event);
        gameSocket.broadcast(gameId, event.encode());
    }
}
