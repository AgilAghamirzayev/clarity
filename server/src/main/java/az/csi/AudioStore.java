package az.csi;

import java.io.*;
import java.net.URI;
import org.springframework.stereotype.Component;
import software.amazon.awssdk.auth.credentials.*;
import software.amazon.awssdk.core.sync.RequestBody;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.s3.*;
import software.amazon.awssdk.services.s3.model.*;

@Component
class AudioStore {
  final S3Client client;
  final String bucket;

  AudioStore() {
    var env = System.getenv();
    bucket = env.getOrDefault("S3_BUCKET", "csi-audio");
    client =
        S3Client.builder()
            .region(Region.US_EAST_1)
            .endpointOverride(URI.create(env.getOrDefault("S3_ENDPOINT", "http://localhost:9100")))
            .forcePathStyle(true)
            .credentialsProvider(
                StaticCredentialsProvider.create(
                    AwsBasicCredentials.create(env.get("S3_ACCESS_KEY"), env.get("S3_SECRET_KEY"))))
            .build();
  }

  synchronized void ensureBucket() {
    try {
      client.headBucket(b -> b.bucket(bucket));
    } catch (NoSuchBucketException e) {
      client.createBucket(b -> b.bucket(bucket));
    } catch (S3Exception e) {
      if (e.statusCode() == 404) client.createBucket(b -> b.bucket(bucket));
      else throw e;
    }
  }

  void put(String key, InputStream stream, long size, String type) {
    ensureBucket();
    client.putObject(
        b -> b.bucket(bucket).key(key).contentType(type),
        RequestBody.fromInputStream(stream, size));
  }

  byte[] get(String key) {
    return client.getObjectAsBytes(b -> b.bucket(bucket).key(key)).asByteArray();
  }

  void delete(String key) {
    client.deleteObject(b -> b.bucket(bucket).key(key));
  }

  static String mediaType(byte[] head) {
    if (head.length >= 12
        && new String(head, 0, 4, java.nio.charset.StandardCharsets.US_ASCII).equals("RIFF")
        && new String(head, 8, 4, java.nio.charset.StandardCharsets.US_ASCII).equals("WAVE"))
      return "audio/wav";
    if (head.length >= 4
        && new String(head, 0, 4, java.nio.charset.StandardCharsets.US_ASCII).equals("fLaC"))
      return "audio/flac";
    if (head.length >= 3
        && (new String(head, 0, 3, java.nio.charset.StandardCharsets.US_ASCII).equals("ID3")
            || ((head[0] & 255) == 255 && (head[1] & 224) == 224))) return "audio/mpeg";
    throw new IllegalArgumentException("Unsupported audio signature");
  }
}
