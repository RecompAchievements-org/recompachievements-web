using System.Buffers.Text;
using System.Security.Cryptography;

namespace RecompAchievements.Api.Infrastructure;

/** Random secrets handed to people or the website (confirmation links, password reset links,
 *  session tokens). Only their SHA-256 hash is stored, so a database leak reveals no usable token.
**/
internal static class SecureToken
{
    private const int TokenBytes = 32;

    public static (string Token, byte[] Hash) Create()
    {
        var bytes = RandomNumberGenerator.GetBytes(TokenBytes);
        return (Base64Url.EncodeToString(bytes), SHA256.HashData(bytes));
    }

    // Returns null for anything that isn't a well-formed token (TryDecodeFromChars throws on bad input).
    public static byte[]? TryHash(string token)
    {
        if (!Base64Url.IsValid(token, out var decodedLength) || decodedLength != TokenBytes)
        {
            return null;
        }

        var bytes = new byte[TokenBytes];
        Base64Url.DecodeFromChars(token, bytes);
        return SHA256.HashData(bytes);
    }
}
