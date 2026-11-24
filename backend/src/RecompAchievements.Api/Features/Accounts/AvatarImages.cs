using System.Security.Cryptography;
using RecompAchievements.Api.Infrastructure.Media;
using SkiaSharp;

namespace RecompAchievements.Api.Features.Accounts;

public sealed record PlayerAvatarResponse(string Small, string Large);

internal sealed record ProcessedAvatar(string Hash, byte[] Small, byte[] Large);

/** Turns an upload into safe profile photos. The real image is decoded (the file name and type are
 *  never trusted), then redrawn from its pixels, so metadata and anything hidden in the file are gone.
**/
internal static class AvatarImages
{
    public const int MaxUploadBytes = 1_000_000;
    private const int SmallSize = 96;
    private const int LargeSize = 512;
    private const int MaxDimension = 6000;
    private const long MaxPixels = 24_000_000;
    private const int WebpQuality = 82;

    public static string KeyPrefix(Guid userId, string hash) => $"avatars/{userId:N}/{hash}";

    public static string[] Keys(string prefix) => [$"{prefix}-{SmallSize}.webp", $"{prefix}-{LargeSize}.webp"];

    public static string LargeKey(string prefix) => $"{prefix}-{LargeSize}.webp";

    public static PlayerAvatarResponse? Urls(IMediaStore media, string? prefix)
    {
        if (prefix is null || media.PublicUrl($"{prefix}-{SmallSize}.webp") is not { } small || media.PublicUrl(LargeKey(prefix)) is not { } large)
        {
            return null;
        }

        return new PlayerAvatarResponse(small.ToString(), large.ToString());
    }

    public static ProcessedAvatar? Process(byte[] upload)
    {
        using var data = SKData.CreateCopy(upload);
        using var codec = SKCodec.Create(data);
        if (codec is null
            || codec.EncodedFormat is not (SKEncodedImageFormat.Jpeg or SKEncodedImageFormat.Png or SKEncodedImageFormat.Webp)
            || codec.FrameCount > 1
            || codec.Info.Width is < 1 or > MaxDimension
            || codec.Info.Height is < 1 or > MaxDimension
            || (long)codec.Info.Width * codec.Info.Height > MaxPixels)
        {
            return null;
        }

        using var decoded = new SKBitmap(new SKImageInfo(codec.Info.Width, codec.Info.Height, SKColorType.Rgba8888, SKAlphaType.Premul));
        if (codec.GetPixels(decoded.Info, decoded.GetPixels()) is not (SKCodecResult.Success or SKCodecResult.IncompleteInput))
        {
            return null;
        }

        using var large = DrawSquare(decoded, codec.EncodedOrigin, LargeSize);
        using var small = DrawSquare(decoded, codec.EncodedOrigin, SmallSize);
        var largeBytes = Encode(large);
        var smallBytes = Encode(small);
        return largeBytes is null || smallBytes is null
            ? null
            : new ProcessedAvatar(Convert.ToHexStringLower(SHA256.HashData(largeBytes))[..32], smallBytes, largeBytes);
    }

    private static byte[]? Encode(SKBitmap bitmap)
    {
        using var image = SKImage.FromBitmap(bitmap);
        using var encoded = image.Encode(SKEncodedImageFormat.Webp, WebpQuality);
        return encoded?.ToArray();
    }

    // Center-crops to a square and applies the camera's orientation before its metadata is dropped.
    private static SKBitmap DrawSquare(SKBitmap source, SKEncodedOrigin origin, int size)
    {
        var side = Math.Min(source.Width, source.Height);
        var crop = SKRect.Create((source.Width - side) / 2f, (source.Height - side) / 2f, side, side);
        var output = new SKBitmap(new SKImageInfo(size, size, SKColorType.Rgba8888, SKAlphaType.Premul));
        using var canvas = new SKCanvas(output);
        canvas.Clear(SKColors.Transparent);
        canvas.Translate(size / 2f, size / 2f);
        ApplyOrigin(canvas, origin);
        canvas.Translate(-size / 2f, -size / 2f);
        using var image = SKImage.FromBitmap(source);
        canvas.DrawImage(image, crop, SKRect.Create(size, size), new SKSamplingOptions(SKCubicResampler.Mitchell));
        canvas.Flush();
        return output;
    }

    private static void ApplyOrigin(SKCanvas canvas, SKEncodedOrigin origin)
    {
        switch (origin)
        {
            case SKEncodedOrigin.TopRight:
                canvas.Scale(-1, 1);
                break;
            case SKEncodedOrigin.BottomRight:
                canvas.RotateDegrees(180);
                break;
            case SKEncodedOrigin.BottomLeft:
                canvas.Scale(1, -1);
                break;
            case SKEncodedOrigin.LeftTop:
                canvas.RotateDegrees(90);
                canvas.Scale(1, -1);
                break;
            case SKEncodedOrigin.RightTop:
                canvas.RotateDegrees(90);
                break;
            case SKEncodedOrigin.RightBottom:
                canvas.RotateDegrees(-90);
                canvas.Scale(1, -1);
                break;
            case SKEncodedOrigin.LeftBottom:
                canvas.RotateDegrees(-90);
                break;
        }
    }
}
